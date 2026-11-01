mod artifacts;
mod cluster;
mod signer;

use anyhow::{Context, Result, bail, ensure};
use artifacts::{Artifact, FileInfo};
use ckb_jsonrpc_types as json;
use ckb_sdk::{
    Address, CkbRpcClient, IndexerRpcAsyncClient, NetworkType, ScriptId,
    constants::{GENESIS_BLOCK_HASH_MAINNET, GENESIS_BLOCK_HASH_TESTNET, SIGHASH_TYPE_HASH},
    traits::{
        DefaultCellCollector, DefaultCellDepResolver, DefaultHeaderDepResolver,
        DefaultTransactionDependencyProvider,
    },
    tx_builder::{CapacityBalancer, TxBuilder, transfer::CapacityTransferBuilder, unlock_tx},
    unlock::{ScriptUnlocker, SecpSighashUnlocker},
};
use ckb_types::{
    H256,
    bytes::Bytes,
    core::{BlockView, ScriptHashType, TransactionView},
    packed::{Script, WitnessArgs},
    prelude::*,
};
use clap::{Args, Parser, Subcommand, ValueEnum};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::PathBuf,
    str::FromStr,
    thread,
    time::{Duration, Instant},
};

#[derive(Parser)]
#[command(
    version,
    about = "Publish a compressed Seedsong ZIP as one CKB data Cell; sign using a ckb-cli account"
)]
struct Cli {
    #[command(subcommand)]
    command: Action,
}
#[derive(Subcommand)]
enum Action {
    /// Show exact occupied capacity and hashes offline; no RPC or account access.
    Plan(Bundle),
    /// Build, sign, save a receipt, then broadcast a deployment transaction.
    Deploy(Deploy),
    /// Check commitment, live Cells, and every deployed file against its receipt hash.
    Verify(Verify),
    /// Inspect the Cluster metadata and occupied capacity using the released ZIP.
    #[command(name = "cluster-plan")]
    ClusterPlan(cluster::Config),
    /// Create a testnet Spore Cluster V2, signed by the existing ckb-cli account.
    #[command(name = "cluster-create")]
    ClusterCreate(cluster::Create),
    /// Verify a created Cluster using its saved receipt.
    #[command(name = "cluster-verify")]
    ClusterVerify(cluster::Verify),
}
#[derive(Clone, Copy, Debug, ValueEnum)]
enum Network {
    Testnet,
    Mainnet,
    Dev,
}
impl Network {
    fn sdk(self) -> NetworkType {
        match self {
            Self::Testnet => NetworkType::Testnet,
            Self::Mainnet => NetworkType::Mainnet,
            Self::Dev => NetworkType::Dev,
        }
    }
}
fn default_base() -> PathBuf {
    // Cargo provides an absolute source path, independent of where the CLI runs.
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../vendor/seedsong-base")
}

#[derive(Args)]
struct Bundle {
    /// Standard secp256k1-blake160 owner/funding address (ckb-cli account).
    #[arg(long = "from")]
    owner: String,
    #[arg(long, value_enum, default_value = "testnet")]
    network: Network,
    /// Built seedsong-base checkout. Defaults to the UI repository's submodule;
    /// an explicit relative path is resolved from the current working directory.
    #[arg(long, default_value_os_t = default_base())]
    base: PathBuf,
    /// Add a raw file under a unique logical name; may be repeated.
    #[arg(long = "file", value_name = "NAME=PATH", value_parser = file_arg)]
    extra: Vec<(String, PathBuf)>,
    /// Include only --file arguments and bundle.json inside the mandatory ZIP.
    #[arg(long)]
    no_defaults: bool,
}
#[derive(Args)]
struct Deploy {
    #[command(flatten)]
    bundle: Bundle,
    /// Node RPC endpoint; it must belong to --network.
    #[arg(long)]
    rpc: String,
    /// Optional separate CKB indexer endpoint; defaults to --rpc.
    #[arg(long)]
    indexer_url: Option<String>,
    /// Fee rate in shannons per 1,000 bytes.
    #[arg(long, default_value_t = 1000)]
    fee_rate: u64,
    #[arg(long, default_value = "ckb-cli")]
    ckb_cli: PathBuf,
    /// Override CKB_CLI_HOME; otherwise inherit ckb-cli's usual configuration.
    #[arg(long)]
    ckb_cli_home: Option<PathBuf>,
    /// New local receipt file. Existing files are never overwritten by deploy.
    #[arg(long)]
    output: PathBuf,
    /// Wait for commitment after broadcast; zero returns immediately.
    #[arg(long, default_value_t = 180)]
    wait_secs: u64,
}
#[derive(Args)]
struct Verify {
    #[arg(long)]
    receipt: PathBuf,
    #[arg(long)]
    rpc: String,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeployedFile {
    #[serde(flatten)]
    info: FileInfo,
    out_point: json::OutPoint,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Receipt {
    schema: String,
    status: String,
    network: String,
    rpc: String,
    genesis_hash: H256,
    owner_address: String,
    transaction_hash: H256,
    transaction_bytes: usize,
    fee_shannons: u64,
    files: Vec<DeployedFile>,
    /// Saved before broadcasting, for recovery after an interrupted RPC call.
    signed_transaction: json::Transaction,
}
fn file_arg(s: &str) -> Result<(String, PathBuf), String> {
    let (name, path) = s.split_once('=').ok_or("Expected NAME=PATH")?;
    if name.is_empty() || path.is_empty() {
        return Err("Expected a nonempty NAME=PATH".into());
    }
    Ok((name.into(), path.into()))
}
fn owner(bundle: &Bundle) -> Result<(Script, [u8; 20])> {
    owner_lock(&bundle.owner, bundle.network)
}
fn owner_lock(value: &str, network: Network) -> Result<(Script, [u8; 20])> {
    let address = Address::from_str(value).map_err(anyhow::Error::msg)?;
    ensure!(
        address.network().to_prefix() == network.sdk().to_prefix(),
        "Address prefix does not match --network"
    );
    let lock = Script::from(&address);
    ensure!(
        lock.code_hash() == SIGHASH_TYPE_HASH.pack()
            && lock.hash_type() == ScriptHashType::Type.into()
            && lock.args().raw_data().len() == 20,
        "Only standard secp256k1-blake160 sighash addresses are supported (not multisig, OmniLock or derived addresses)"
    );
    let account = lock.args().raw_data().as_ref().try_into()?;
    Ok((lock, account))
}
fn genesis(client: &CkbRpcClient, network: Network) -> Result<BlockView> {
    let block: BlockView = client
        .get_block_by_number(0.into())?
        .context("Node returned no genesis block")?
        .into();
    let hash: H256 = block.hash().unpack();
    match network {
        Network::Testnet => ensure!(hash == GENESIS_BLOCK_HASH_TESTNET, "RPC is not CKB testnet"),
        Network::Mainnet => ensure!(hash == GENESIS_BLOCK_HASH_MAINNET, "RPC is not CKB mainnet"),
        Network::Dev => ensure!(
            hash != GENESIS_BLOCK_HASH_MAINNET && hash != GENESIS_BLOCK_HASH_TESTNET,
            "--network dev cannot target a public network"
        ),
    }
    Ok(block)
}
fn save(path: &std::path::Path, receipt: &impl Serialize, initial: bool) -> Result<()> {
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or_else(|| std::path::Path::new("."));
    fs::create_dir_all(parent)?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)?;
    serde_json::to_writer_pretty(temp.as_file_mut(), receipt)?;
    temp.write_all(b"\n")?;
    temp.as_file().sync_all()?;
    if initial {
        temp.persist_noclobber(path).map_err(|e| e.error)?;
    } else {
        temp.persist(path).map_err(|e| e.error)?;
    }
    Ok(())
}
fn deploy(args: Deploy) -> Result<()> {
    ensure!(args.fee_rate > 0, "Fee rate must be positive");
    ensure!(
        !args.output.exists(),
        "Receipt already exists; choose a new --output. Use verify to inspect a previous deployment."
    );
    let (lock, account) = owner(&args.bundle)?;
    let files = artifacts::load(
        &args.bundle.base,
        args.bundle.no_defaults,
        &args.bundle.extra,
        &lock,
    )?;
    let plan = artifacts::plan(
        &files,
        args.bundle.owner.clone(),
        args.bundle.network.sdk().to_string(),
    )?;
    eprintln!(
        "{} Cells, {} CKB occupied before fees; owner {}",
        files.len(),
        plan.total_capacity_ckb,
        args.bundle.owner
    );
    let client = CkbRpcClient::new(&args.rpc);
    let block = genesis(&client, args.bundle.network)?;
    let dep_resolver = DefaultCellDepResolver::from_genesis(&block)?;
    let headers = DefaultHeaderDepResolver::new(&args.rpc);
    let provider = DefaultTransactionDependencyProvider::new(&args.rpc, 10);
    let mut collector = DefaultCellCollector::new(&args.rpc);
    if let Some(url) = &args.indexer_url {
        collector.indexer_client = IndexerRpcAsyncClient::new(url);
    }
    let placeholder = WitnessArgs::new_builder()
        .lock(Some(Bytes::from(vec![0; 65])).pack())
        .build();
    let balancer = CapacityBalancer::new_simple(lock, placeholder, args.fee_rate);
    let signer = signer::CliSigner {
        account,
        executable: args.ckb_cli,
        home: args.ckb_cli_home,
    };
    let unlocker = SecpSighashUnlocker::from(Box::new(signer) as Box<_>);
    let mut unlockers: HashMap<ScriptId, Box<dyn ScriptUnlocker>> = HashMap::new();
    unlockers.insert(
        ScriptId::new_type(SIGHASH_TYPE_HASH.clone()),
        Box::new(unlocker),
    );
    let builder = CapacityTransferBuilder::new(
        files
            .iter()
            .map(|a| (a.output.clone(), a.data.clone()))
            .collect(),
    );
    let balanced = builder.build_balanced(&mut collector, &dep_resolver, &headers, &provider, &balancer, &unlockers)
        .context("Cannot collect/balance funding Cells; check account balance, indexer URL and sync status")?;
    let mut input_capacity = 0u64;
    for input in balanced.inputs() {
        use ckb_sdk::traits::TransactionDependencyProvider;
        let capacity: u64 = provider
            .get_cell(&input.previous_output())?
            .capacity()
            .unpack();
        input_capacity = input_capacity
            .checked_add(capacity)
            .context("Input capacity overflow")?;
    }
    let output_capacity: u64 = balanced
        .outputs()
        .into_iter()
        .map(|o| -> u64 { o.capacity().unpack() })
        .sum();
    let fee = input_capacity
        .checked_sub(output_capacity)
        .context("Outputs exceed inputs")?;
    eprintln!(
        "Balanced transaction: {} inputs, {} outputs, fee {} CKB.",
        balanced.inputs().len(),
        balanced.outputs().len(),
        artifacts::ckb(fee)
    );
    let (tx, locked) = unlock_tx(balanced, &provider, &unlockers)?;
    ensure!(locked.is_empty(), "Some input groups could not be signed");
    check_outputs(&tx, &files)?;
    let transaction_hash: H256 = tx.hash().unpack();
    let mut receipt = Receipt {
        schema: "seedsong-deployment/2".into(),
        status: "prepared".into(),
        network: args.bundle.network.sdk().to_string(),
        rpc: args.rpc.clone(),
        genesis_hash: block.hash().unpack(),
        owner_address: args.bundle.owner,
        transaction_hash: transaction_hash.clone(),
        transaction_bytes: tx.data().as_slice().len(),
        fee_shannons: fee,
        files: files
            .iter()
            .map(|file| DeployedFile {
                info: file.info.clone(),
                out_point: json::OutPoint {
                    tx_hash: transaction_hash.clone(),
                    index: file.info.index.into(),
                },
            })
            .collect(),
        signed_transaction: json::TransactionView::from(tx).inner,
    };
    save(&args.output, &receipt, true)
        .context("Cannot create deployment receipt; transaction was not sent")?;
    eprintln!(
        "Receipt saved to {}. Broadcasting {transaction_hash:#x}...",
        args.output.display()
    );
    let returned = client.send_transaction(receipt.signed_transaction.clone(), Some(json::OutputsValidator::Passthrough))
        .context("Broadcast failed or its result is uncertain. The signed transaction and expected hash are in the prepared receipt; check that hash before retrying")?;
    ensure!(
        returned == transaction_hash,
        "Node returned an unexpected transaction hash"
    );
    receipt.status = "submitted".into();
    save(&args.output, &receipt, false)?;
    println!("Transaction: {transaction_hash:#x}");
    for file in &receipt.files {
        println!(
            "{}: {transaction_hash:#x}:{} ({} bytes)",
            file.info.name, file.info.index, file.info.bytes
        );
    }
    if args.wait_secs > 0 {
        let start = Instant::now();
        loop {
            if verify(&client, &receipt)? {
                receipt.status = "committed".into();
                save(&args.output, &receipt, false)?;
                println!("Committed; all deployed file hashes verified.");
                break;
            }
            ensure!(
                start.elapsed() < Duration::from_secs(args.wait_secs),
                "Transaction submitted but commitment wait timed out; receipt retained. Run verify rather than deploying again."
            );
            thread::sleep(Duration::from_secs(3));
        }
    }
    Ok(())
}
fn check_outputs(tx: &TransactionView, files: &[Artifact]) -> Result<()> {
    for file in files {
        let index = file.info.index as usize;
        ensure!(
            tx.outputs().get(index) == Some(file.output.clone()),
            "Builder changed artifact output {}",
            file.info.name
        );
        ensure!(
            tx.outputs_data().get(index).map(|b| b.raw_data()) == Some(file.data.clone()),
            "Builder changed artifact data {}",
            file.info.name
        );
    }
    Ok(())
}
fn verify(client: &CkbRpcClient, receipt: &Receipt) -> Result<bool> {
    if receipt.schema == "seedsong-deployment/2" {
        ensure!(
            receipt.files.len() == 1
                && receipt.files[0].info.name == "bundle.zip"
                && receipt.files[0].info.index == 0
                && !receipt.files[0].info.archive_files.is_empty(),
            "ZIP deployment receipt must describe a single archive output"
        );
    }
    let actual = client
        .get_block_by_number(0.into())?
        .context("Missing genesis")?;
    ensure!(
        actual.header.hash == receipt.genesis_hash,
        "Verification RPC network differs from deployment"
    );
    let Some(response) = client.get_transaction(receipt.transaction_hash.clone())? else {
        return Ok(false);
    };
    match response.tx_status.status {
        json::Status::Rejected => bail!("Transaction rejected: {:?}", response.tx_status.reason),
        json::Status::Committed => {}
        _ => return Ok(false),
    }
    let transaction = response
        .transaction
        .context("Committed transaction body is unavailable")?;
    let tx: json::TransactionView = match transaction.inner {
        json::Either::Left(tx) => tx,
        json::Either::Right(_) => bail!("Node returned encoded transaction instead of JSON"),
    };
    let expected: TransactionView =
        ckb_types::packed::Transaction::from(receipt.signed_transaction.clone()).into_view();
    ensure!(
        tx.inner == receipt.signed_transaction
            && tx.hash == receipt.transaction_hash
            && H256::from_slice(expected.hash().as_slice())? == receipt.transaction_hash,
        "Transaction or receipt mismatch"
    );
    for file in &receipt.files {
        let live = client.get_live_cell(file.out_point.clone(), false)?;
        ensure!(
            live.status == "live",
            "Artifact Cell {} is no longer live: {}",
            file.info.name,
            live.status
        );
        let index = file.info.index as usize;
        ensure!(
            file.out_point.tx_hash == receipt.transaction_hash
                && file.out_point.index.value() == file.info.index,
            "Invalid file OutPoint"
        );
        let data = tx
            .inner
            .outputs_data
            .get(index)
            .context("Missing output data")?
            .as_bytes();
        ensure!(
            data.len() == file.info.bytes
                && artifacts::sha256(data) == file.info.sha256
                && artifacts::data_hash(data) == file.info.data_hash,
            "Hash mismatch for {}",
            file.info.name
        );
        if !file.info.archive_files.is_empty() {
            artifacts::verify_archive(data, &file.info.archive_files)?;
        }
        ensure!(
            tx.inner
                .outputs
                .get(index)
                .context("Missing output")?
                .capacity
                .value()
                == file.info.capacity_shannons,
            "Capacity mismatch for {}",
            file.info.name
        );
    }
    Ok(true)
}
fn main() -> Result<()> {
    match Cli::parse().command {
        Action::Plan(bundle) => {
            let (lock, _) = owner(&bundle)?;
            let files = artifacts::load(&bundle.base, bundle.no_defaults, &bundle.extra, &lock)?;
            let plan = artifacts::plan(&files, bundle.owner, bundle.network.sdk().to_string())?;
            println!("{}", serde_json::to_string_pretty(&plan)?);
        }
        Action::Deploy(args) => deploy(args)?,
        Action::ClusterPlan(args) => cluster::plan(args)?,
        Action::ClusterCreate(args) => cluster::create(args)?,
        Action::ClusterVerify(args) => cluster::verify(args)?,
        Action::Verify(args) => {
            let receipt: Receipt = serde_json::from_slice(&fs::read(args.receipt)?)?;
            ensure!(
                matches!(
                    receipt.schema.as_str(),
                    "seedsong-deployment/1" | "seedsong-deployment/2"
                ),
                "Unsupported receipt schema"
            );
            ensure!(
                verify(&CkbRpcClient::new(&args.rpc), &receipt)?,
                "Transaction is not yet committed or is unknown to this node"
            );
            println!("Committed; all deployed file hashes verified.");
        }
    }
    Ok(())
}
