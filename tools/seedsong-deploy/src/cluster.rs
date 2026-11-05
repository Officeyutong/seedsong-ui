//! Spore Cluster V2 creation. Schema/CoBuild definitions follow @ckb-ccc/spore.
use crate::{
    Network,
    artifacts::{self, ArchiveFile},
    signer::CliSigner,
};
use anyhow::{Context, Result, bail, ensure};
use ckb_hash::blake2b_256;
use ckb_jsonrpc_types as json;
use ckb_sdk::{
    CkbRpcClient, IndexerRpcAsyncClient, ScriptId,
    constants::SIGHASH_TYPE_HASH,
    traits::{
        CellCollector, CellDepResolver, CellQueryOptions, DefaultCellCollector,
        DefaultCellDepResolver, DefaultHeaderDepResolver, DefaultTransactionDependencyProvider,
        TransactionDependencyProvider, ValueRangeOption,
    },
    tx_builder::{CapacityBalancer, unlock_tx},
    unlock::{ScriptUnlocker, SecpSighashUnlocker},
};
use ckb_types::{
    H256,
    bytes::Bytes,
    core::{Capacity, DepType, FeeRate, ScriptHashType, TransactionBuilder, TransactionView},
    packed::{CellDep, CellInput, CellOutput, Script, WitnessArgs},
    prelude::*,
};
use clap::Args;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::{HashMap, HashSet},
    fs,
    io::{Cursor, Read},
    path::PathBuf,
    str::FromStr,
    thread,
    time::{Duration, Instant},
};

pub const DEFAULT_ARCHIVE: &str =
    "0x4d54a43844847bd053b8cedf6bf70deb5cdb5904a43378f6db7c4426887a22ba:0";
const CLUSTER_CODE_HASH: &str =
    "0x0bbe768b519d8ea7b96d58f1182eb7e6ef96c541fbd9526975077ee09f049058";
const CLUSTER_CODE_TX: &str = "0xcebb174d6e300e26074aea2f5dbd7f694bb4fe3de52b6dfe205e54f90164510a";
const DOB0: &str = "0x13cac78ad8482202f18f9df4ea707611c35f994375fa03ae79121312dda9925c";
const DOB1: &str = "0xda3525549b72970b4c95f5b5749357f20d1293d335710b674f09c32f7d54b6dc";

#[derive(Args)]
pub struct Config {
    /// Existing ckb-cli account address; owns the Cluster and authorizes minting.
    #[arg(long = "from")]
    pub owner: String,
    #[arg(long, default_value = "https://testnet.ckb.dev/")]
    pub rpc: String,
    /// Live, committed ZIP Cell containing the released decoder and patterns.
    #[arg(long, default_value = DEFAULT_ARCHIVE)]
    pub archive: String,
    #[arg(long, default_value = "Seedsong")]
    pub name: String,
    #[arg(
        long,
        default_value = "Seedsong: deterministic music and SVG covers from 32-byte DNA."
    )]
    pub description: String,
}
#[derive(Args)]
pub struct Create {
    #[command(flatten)]
    pub config: Config,
    #[arg(long)]
    pub indexer_url: Option<String>,
    #[arg(long, default_value_t = 1000)]
    pub fee_rate: u64,
    #[arg(long, default_value = "ckb-cli")]
    pub ckb_cli: PathBuf,
    #[arg(long)]
    pub ckb_cli_home: Option<PathBuf>,
    /// New receipt path; never overwrite a previous creation receipt.
    #[arg(long)]
    pub output: PathBuf,
    #[arg(long, default_value_t = 180)]
    pub wait_secs: u64,
}
#[derive(Args)]
pub struct Verify {
    #[arg(long)]
    pub receipt: PathBuf,
    #[arg(long, default_value = "https://testnet.ckb.dev/")]
    pub rpc: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Archive {
    pub out_point: json::OutPoint,
    pub data_hash: String,
    pub wasm_sha256: String,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Receipt {
    schema: String,
    status: String,
    network: String,
    genesis_hash: H256,
    owner_address: String,
    name: String,
    description: Value,
    archive: Archive,
    cluster_id: H256,
    cluster_type_hash: H256,
    cluster_out_point: json::OutPoint,
    capacity_shannons: u64,
    fee_shannons: u64,
    transaction_hash: H256,
    signed_transaction: json::Transaction,
}
fn parse_hash(value: &str) -> Result<H256> {
    let hex = value
        .strip_prefix("0x")
        .or_else(|| value.strip_prefix("0X"))
        .unwrap_or(value);
    Ok(H256::from_str(hex)?)
}
fn parse_out_point(value: &str) -> Result<json::OutPoint> {
    let (hash, index) = value
        .split_once(':')
        .context("Archive must be TX_HASH:INDEX")?;
    let index = if let Some(hex) = index.strip_prefix("0x") {
        u32::from_str_radix(hex, 16)?
    } else {
        index.parse()?
    };
    Ok(json::OutPoint {
        tx_hash: parse_hash(hash)?,
        index: index.into(),
    })
}
fn transaction(client: &CkbRpcClient, hash: &H256) -> Result<Option<TransactionView>> {
    let Some(response) = client.get_transaction(hash.clone())? else {
        return Ok(None);
    };
    match response.tx_status.status {
        json::Status::Committed => {}
        json::Status::Rejected => bail!("Transaction rejected: {:?}", response.tx_status.reason),
        _ => return Ok(None),
    }
    let body = response
        .transaction
        .context("Committed transaction body unavailable")?;
    let tx = match body.inner {
        json::Either::Left(tx) => tx,
        json::Either::Right(_) => bail!("Expected JSON transaction"),
    };
    let view = ckb_types::packed::Transaction::from(tx.inner).into_view();
    ensure!(
        view.hash().as_slice() == hash.as_bytes(),
        "RPC transaction hash mismatch"
    );
    Ok(Some(view))
}
fn live_data(client: &CkbRpcClient, point: json::OutPoint) -> Result<Vec<u8>> {
    let cell = client.get_live_cell(point, true)?;
    ensure!(cell.status == "live", "Referenced Cell is not live");
    let data = cell
        .cell
        .context("Missing live Cell")?
        .data
        .context("Missing live Cell data")?;
    let bytes = data.content.into_bytes().to_vec();
    ensure!(
        blake2b_256(&bytes).as_slice() == data.hash.as_bytes(),
        "Live Cell data hash mismatch"
    );
    Ok(bytes)
}
fn read_zip_file(zip: &mut zip::ZipArchive<Cursor<&[u8]>>, name: &str) -> Result<Vec<u8>> {
    let mut data = Vec::new();
    zip.by_name(name)?.read_to_end(&mut data)?;
    Ok(data)
}
fn released_patterns(
    client: &CkbRpcClient,
    point: json::OutPoint,
) -> Result<(Archive, Value, Value)> {
    let tx =
        transaction(client, &point.tx_hash)?.context("Archive transaction is not committed")?;
    let index = point.index.value() as usize;
    let data = tx
        .outputs_data()
        .get(index)
        .context("Archive output index not found")?
        .raw_data();
    ensure!(data.len() <= 8 * 1024 * 1024, "Archive exceeds 8 MiB");
    ensure!(
        live_data(client, point.clone())? == data.as_ref(),
        "Live archive differs from its creation transaction"
    );
    let mut zip = zip::ZipArchive::new(Cursor::new(data.as_ref()))?;
    let mut names = HashSet::new();
    let mut expanded = 0u64;
    ensure!(zip.len() <= 64, "Too many archive entries");
    for i in 0..zip.len() {
        let entry = zip.by_index(i)?;
        ensure!(
            names.insert(entry.name().to_owned())
                && entry
                    .name()
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b)),
            "Duplicate or invalid archive entry"
        );
        expanded = expanded
            .checked_add(entry.size())
            .context("Archive size overflow")?;
        ensure!(
            expanded <= 16 * 1024 * 1024,
            "Archive extraction limit exceeded"
        );
    }
    let manifest = read_zip_file(&mut zip, "bundle.json")?;
    let value: Value = serde_json::from_slice(&manifest)?;
    ensure!(
        value["schema"] == "seedsong-archive/1" && value["decoderAbiVersion"] == 1,
        "Unsupported archive schema/ABI"
    );
    let mut files: Vec<ArchiveFile> = serde_json::from_value(value["files"].clone())?;
    ensure!(
        files.iter().all(|f| f.name != "bundle.json"),
        "Manifest cannot list itself"
    );
    files.push(ArchiveFile {
        name: "bundle.json".into(),
        bytes: manifest.len(),
        sha256: artifacts::sha256(&manifest),
        data_hash: artifacts::data_hash(&manifest),
    });
    artifacts::verify_archive(&data, &files)?;
    let wasm = read_zip_file(&mut zip, "decoder.wasm")?;
    ensure!(wasm.starts_with(b"\0asm\x01\0\0\0"), "Invalid WASM");
    let build: Value = serde_json::from_slice(&read_zip_file(&mut zip, "decoder.json")?)?;
    let wasm_sha = artifacts::sha256(&wasm);
    ensure!(
        build["wasmBytes"].as_u64() == Some(wasm.len() as u64)
            && build["sha256"] == wasm_sha
            && build["abiVersion"] == 1,
        "Decoder build manifest mismatch"
    );
    for name in ["loader.js", "spec.md", "spec-v1.md"] {
        ensure!(
            !read_zip_file(&mut zip, name)?.is_empty(),
            "Missing release file {name}"
        );
    }
    ensure!(
        String::from_utf8(read_zip_file(&mut zip, "spec.md")?)?.contains("seedsong-music/2"),
        "The archive must describe seedsong-music/2"
    );
    let document = String::from_utf8(read_zip_file(&mut zip, "pattern.md")?)?;
    ensure!(
        document.contains("seedsong-pattern/1"),
        "Unsupported Seedsong pattern version"
    );
    let mut patterns = Vec::new();
    for block in document.split("```json").skip(1) {
        let (json, _) = block.split_once("```").context("Unclosed JSON fence")?;
        let json: Value = serde_json::from_str(json.trim())?;
        if json.is_array() {
            patterns.push(json);
        }
    }
    ensure!(
        patterns.len() == 2 && patterns.iter().all(|v| !v.as_array().unwrap().is_empty()),
        "Expected DOB/0 and DOB/1 arrays in the archived pattern"
    );
    Ok((
        Archive {
            out_point: point,
            data_hash: artifacts::data_hash(&data),
            wasm_sha256: wasm_sha,
        },
        patterns.remove(0),
        patterns.remove(0),
    ))
}
fn description(
    config: &Config,
    owner: &Script,
    archive: &Archive,
    dob0: Value,
    dob1: Value,
) -> Value {
    json!({
        "description": config.description,
        "dob": { "ver": 1, "decoders": [
            { "decoder": { "type": "code_hash", "hash": DOB0 }, "pattern": dob0 },
            { "decoder": { "type": "code_hash", "hash": DOB1 }, "pattern": dob1 }
        ]},
        "seedsong": {
            "pattern": "seedsong-pattern/1",
            "music": { "spec": "seedsong-music/2", "decoder": {
                "type": "archive", "format": "zip", "schema": "seedsong-archive/1",
                "out_point": archive.out_point, "data_hash": archive.data_hash,
                "entry": "decoder.wasm", "loader": "loader.js", "manifest": "bundle.json",
                "wasm_sha256": archive.wasm_sha256, "abi": 1
            }},
            "documents": { "pattern": "pattern.md", "music": "spec.md", "legacy": "spec-v1.md" },
            "minting": { "mode": "owner-authorized", "authorization": "current-cluster-lock", "initial_owner_lock_hash": format!("{:#x}", owner.calc_script_hash()), "public_proxy": false }
        }
    })
}
// Molecule table and dynvec layouts share the same offset format.
fn table(fields: &[Vec<u8>]) -> Result<Vec<u8>> {
    let header = 4usize
        .checked_mul(fields.len() + 1)
        .context("Molecule header overflow")?;
    let total = fields.iter().try_fold(header, |size, field| {
        size.checked_add(field.len())
            .context("Molecule size overflow")
    })?;
    let mut out = u32::try_from(total)?.to_le_bytes().to_vec();
    let mut offset = header;
    for field in fields {
        out.extend(u32::try_from(offset)?.to_le_bytes());
        offset += field.len();
    }
    for field in fields {
        out.extend(field);
    }
    Ok(out)
}
fn bytes(value: &[u8]) -> Result<Vec<u8>> {
    let mut out = u32::try_from(value.len())?.to_le_bytes().to_vec();
    out.extend(value);
    Ok(out)
}
fn cluster_data(name: &str, description: &Value) -> Result<Vec<u8>> {
    table(&[
        bytes(name.as_bytes())?,
        bytes(serde_json::to_string(description)?.as_bytes())?,
        vec![],
    ])
}
fn cluster_id(first: &CellInput, output_index: u64) -> H256 {
    let mut data = first.as_slice().to_vec();
    data.extend(output_index.to_le_bytes());
    H256::from(blake2b_256(data))
}
fn type_script(id: &H256) -> Result<Script> {
    Ok(Script::new_builder()
        .code_hash(parse_hash(CLUSTER_CODE_HASH)?.pack())
        .hash_type(ScriptHashType::Data1)
        .args(Bytes::copy_from_slice(id.as_bytes()).pack())
        .build())
}
fn cluster_output(owner: &Script, id: &H256, data: &[u8]) -> Result<CellOutput> {
    let dummy = CellOutput::new_builder()
        .lock(owner.clone())
        .type_(Some(type_script(id)?).pack())
        .build();
    let capacity = dummy
        .occupied_capacity(Capacity::bytes(data.len())?)?
        .as_u64();
    Ok(dummy.as_builder().capacity(capacity).build())
}
fn cobuild(output: &CellOutput, data: &[u8]) -> Result<Vec<u8>> {
    let script = output
        .type_()
        .to_opt()
        .context("Cluster output needs type script")?;
    // Address::Script union tag 0; SporeAction::CreateCluster union tag 3.
    let mut address = 0u32.to_le_bytes().to_vec();
    address.extend(output.lock().as_slice());
    let create = table(&[
        script.args().raw_data().to_vec(),
        address,
        blake2b_256(data).to_vec(),
    ])?;
    let mut spore_action = 3u32.to_le_bytes().to_vec();
    spore_action.extend(create);
    let action = table(&[
        blake2b_256(b"CCC_DEFAULT_COBUILD_INFO").to_vec(),
        script.calc_script_hash().as_slice().to_vec(),
        bytes(&spore_action)?,
    ])?;
    let message = table(&[table(&[action])?])?;
    let sighash = table(&[bytes(&[])?, message])?;
    let mut witness = 0xff000001u32.to_le_bytes().to_vec();
    witness.extend(sighash);
    Ok(witness)
}
fn contract_dep(client: &CkbRpcClient) -> Result<CellDep> {
    let point = json::OutPoint {
        tx_hash: parse_hash(CLUSTER_CODE_TX)?,
        index: 0.into(),
    };
    ensure!(
        artifacts::data_hash(&live_data(client, point.clone())?) == CLUSTER_CODE_HASH,
        "Cluster V2 contract data hash mismatch"
    );
    Ok(CellDep::new_builder()
        .out_point(point)
        .dep_type(DepType::Code)
        .build())
}
struct Prepared {
    client: CkbRpcClient,
    owner: Script,
    account: [u8; 20],
    archive: Archive,
    description: Value,
    data: Vec<u8>,
}
fn prepare(config: &Config) -> Result<Prepared> {
    ensure!(
        !config.name.trim().is_empty(),
        "Cluster name must not be empty"
    );
    let (owner, account) = crate::owner_lock(&config.owner, Network::Testnet)?;
    let client = CkbRpcClient::new(&config.rpc);
    crate::genesis(&client, Network::Testnet)?;
    let (archive, dob0, dob1) = released_patterns(&client, parse_out_point(&config.archive)?)?;
    let description = description(config, &owner, &archive, dob0, dob1);
    let data = cluster_data(&config.name, &description)?;
    Ok(Prepared {
        client,
        owner,
        account,
        archive,
        description,
        data,
    })
}
pub fn plan(config: Config) -> Result<()> {
    let Prepared {
        client,
        owner,
        archive,
        description,
        data,
        ..
    } = prepare(&config)?;
    contract_dep(&client)?;
    let output = cluster_output(&owner, &H256::default(), &data)?;
    let capacity: u64 = output.capacity().unpack();
    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "schema": "seedsong-cluster-plan/1", "network": "ckb_testnet", "name": config.name,
            "ownerAddress": config.owner, "archive": archive, "description": description,
            "clusterContract": { "codeHash": CLUSTER_CODE_HASH, "hashType": "data1", "txHash": CLUSTER_CODE_TX, "index": 0 },
            "clusterDataBytes": data.len(), "capacityShannons": capacity, "capacityCkb": artifacts::ckb(capacity),
            "clusterId": null, "note": "No transaction sent. Cluster ID derives from the actual first funding input during creation. Minting requires owner authorization; no public mint proxy is created."
        }))?
    );
    Ok(())
}
fn actual_fee(
    tx: &TransactionView,
    provider: &DefaultTransactionDependencyProvider,
) -> Result<u64> {
    let mut inputs = 0u64;
    for input in tx.inputs() {
        let value: u64 = provider
            .get_cell(&input.previous_output())?
            .capacity()
            .unpack();
        inputs = inputs
            .checked_add(value)
            .context("Input capacity overflow")?;
    }
    let outputs = tx.outputs().into_iter().try_fold(0u64, |sum, o| {
        let value: u64 = o.capacity().unpack();
        sum.checked_add(value).context("Output capacity overflow")
    })?;
    inputs.checked_sub(outputs).context("Outputs exceed inputs")
}
pub fn create(args: Create) -> Result<()> {
    ensure!(
        !args.output.exists(),
        "Receipt exists; choose a new --output or run cluster-verify"
    );
    ensure!(args.fee_rate > 0, "Fee rate must be positive");
    let Prepared {
        client,
        owner,
        account,
        archive,
        description,
        data,
    } = prepare(&args.config)?;
    let block = crate::genesis(&client, Network::Testnet)?;
    let deps = DefaultCellDepResolver::from_genesis(&block)?;
    let cluster_dep = contract_dep(&client)?;
    let sighash_dep = deps.resolve(&owner).context("Missing sighash dependency")?;
    let provider = DefaultTransactionDependencyProvider::new(&args.config.rpc, 32);
    let headers = DefaultHeaderDepResolver::new(&args.config.rpc);
    let mut collector = DefaultCellCollector::new(&args.config.rpc);
    if let Some(url) = &args.indexer_url {
        collector.indexer_client = IndexerRpcAsyncClient::new(url);
    }
    let mut query = CellQueryOptions::new_lock(owner.clone());
    query.data_len_range = Some(ValueRangeOption::new_exact(0));
    query.secondary_script_len_range = Some(ValueRangeOption::new_exact(0));
    query.limit = Some(1);
    let (cells, _) = collector.collect_live_cells(&query, true)?;
    let first = CellInput::new_builder()
        .previous_output(
            cells
                .first()
                .context("No mature ordinary funding Cell; fund this ckb-cli account first")?
                .out_point
                .clone(),
        )
        .build();
    let id = cluster_id(&first, 0);
    let output = cluster_output(&owner, &id, &data)?;
    let witness = cobuild(&output, &data)?;
    let placeholder = WitnessArgs::new_builder()
        .lock(Some(Bytes::from(vec![0; 65])).pack())
        .build();
    let balancer = CapacityBalancer::new_simple(owner, placeholder.clone(), args.fee_rate);
    let base = TransactionBuilder::default()
        .input(first.clone())
        .output(output.clone())
        .output_data(Bytes::copy_from_slice(&data).pack())
        .cell_dep(cluster_dep)
        .cell_dep(sighash_dep)
        .witness(placeholder.as_bytes().pack())
        .build();
    // Rebalance from the same base until the fee includes the final CoBuild
    // witness. Do not let extra witnesses become funding-input witnesses.
    let mut accepted_min_fee = 0;
    let mut final_tx = None;
    for _ in 0..8 {
        let mut attempt_collector = collector.clone();
        let (balanced, _) = balancer.rebalance_tx_capacity(
            &base,
            &mut attempt_collector,
            &provider,
            &deps,
            &headers,
            accepted_min_fee,
            None,
        )?;
        ensure!(
            balanced.inputs().get(0) == Some(first.clone()),
            "Builder changed the ID input"
        );
        let mut witnesses: Vec<_> = balanced.witnesses().into_iter().collect();
        witnesses.resize(balanced.inputs().len(), Default::default());
        witnesses.push(Bytes::copy_from_slice(&witness).pack());
        let candidate = balanced
            .as_advanced_builder()
            .set_witnesses(witnesses)
            .build();
        let required = FeeRate::from_u64(args.fee_rate)
            .fee(candidate.data().as_reader().serialized_size_in_block() as u64)
            .as_u64();
        if actual_fee(&candidate, &provider)? >= required {
            final_tx = Some(candidate);
            break;
        }
        accepted_min_fee = required;
    }
    let tx = final_tx.context("Could not converge on a CoBuild-inclusive fee")?;
    let signer = CliSigner {
        account,
        executable: args.ckb_cli,
        home: args.ckb_cli_home,
    };
    let mut unlockers: HashMap<ScriptId, Box<dyn ScriptUnlocker>> = HashMap::new();
    unlockers.insert(
        ScriptId::new_type(SIGHASH_TYPE_HASH.clone()),
        Box::new(SecpSighashUnlocker::from(Box::new(signer) as Box<_>)),
    );
    eprintln!(
        "Creating Seedsong Cluster {id:#x}; fee {} CKB. Signing through ckb-cli...",
        artifacts::ckb(actual_fee(&tx, &provider)?)
    );
    let (tx, locked) = unlock_tx(tx, &provider, &unlockers)?;
    ensure!(locked.is_empty(), "Some inputs remain unsigned");
    ensure!(
        tx.outputs().get(0) == Some(output.clone())
            && tx.outputs_data().get(0).map(|b| b.raw_data())
                == Some(Bytes::copy_from_slice(&data)),
        "Cluster output changed"
    );
    ensure!(
        tx.witnesses().get(tx.inputs().len()).map(|w| w.raw_data())
            == Some(Bytes::copy_from_slice(&witness)),
        "CoBuild witness was changed"
    );
    let hash: H256 = tx.hash().unpack();
    let mut receipt = Receipt {
        schema: "seedsong-cluster/1".into(),
        status: "prepared".into(),
        network: "ckb_testnet".into(),
        genesis_hash: block.hash().unpack(),
        owner_address: args.config.owner,
        name: args.config.name,
        description,
        archive,
        cluster_id: id,
        cluster_type_hash: output.type_().to_opt().unwrap().calc_script_hash().unpack(),
        cluster_out_point: json::OutPoint {
            tx_hash: hash.clone(),
            index: 0.into(),
        },
        capacity_shannons: output.capacity().unpack(),
        fee_shannons: actual_fee(&tx, &provider)?,
        transaction_hash: hash.clone(),
        signed_transaction: json::TransactionView::from(tx).inner,
    };
    crate::save(&args.output, &receipt, true)?;
    let returned = client.send_transaction(receipt.signed_transaction.clone(), Some(json::OutputsValidator::Passthrough))
        .context("Submission failed or is uncertain; inspect the prepared receipt's transactionHash before trying another creation")?;
    ensure!(
        returned == hash,
        "Node returned an unexpected transaction hash"
    );
    receipt.status = "submitted".into();
    crate::save(&args.output, &receipt, false)?;
    println!(
        "Cluster ID: {:#x}\nTransaction: {hash:#x}\nReceipt: {}",
        receipt.cluster_id,
        args.output.display()
    );
    if args.wait_secs > 0 {
        let start = Instant::now();
        while !verify_receipt(&client, &receipt)? {
            ensure!(
                start.elapsed() < Duration::from_secs(args.wait_secs),
                "Submitted; commitment timed out. Use cluster-verify rather than creating again."
            );
            thread::sleep(Duration::from_secs(3));
        }
        receipt.status = "committed".into();
        crate::save(&args.output, &receipt, false)?;
        println!("Cluster committed and verified.");
    }
    Ok(())
}
fn verify_receipt(client: &CkbRpcClient, receipt: &Receipt) -> Result<bool> {
    ensure!(
        receipt.schema == "seedsong-cluster/1" && receipt.network == "ckb_testnet",
        "Unsupported Cluster receipt"
    );
    let block = crate::genesis(client, Network::Testnet)?;
    ensure!(
        block.hash().as_slice() == receipt.genesis_hash.as_bytes(),
        "Receipt network mismatch"
    );
    let Some(tx) = transaction(client, &receipt.transaction_hash)? else {
        return Ok(false);
    };
    ensure!(
        json::TransactionView::from(tx.clone()).inner == receipt.signed_transaction,
        "Signed transaction mismatch"
    );
    ensure!(
        receipt.cluster_out_point.tx_hash == receipt.transaction_hash
            && receipt.cluster_out_point.index.value() == 0,
        "Invalid Cluster OutPoint"
    );
    let first = tx.inputs().get(0).context("Missing first input")?;
    ensure!(
        cluster_id(&first, 0) == receipt.cluster_id,
        "Cluster ID mismatch"
    );
    let output = tx.outputs().get(0).context("Missing Cluster output")?;
    let ty = output.type_().to_opt().context("Missing Cluster type")?;
    ensure!(
        ty == type_script(&receipt.cluster_id)?
            && ty.calc_script_hash().as_slice() == receipt.cluster_type_hash.as_bytes(),
        "Cluster type mismatch"
    );
    let capacity: u64 = output.capacity().unpack();
    ensure!(
        capacity == receipt.capacity_shannons,
        "Cluster capacity mismatch"
    );
    let (owner, _) = crate::owner_lock(&receipt.owner_address, Network::Testnet)?;
    ensure!(output.lock() == owner, "Cluster owner mismatch");
    let decoder = &receipt.description["seedsong"]["music"]["decoder"];
    ensure!(
        decoder["out_point"] == serde_json::to_value(&receipt.archive.out_point)?
            && decoder["data_hash"] == receipt.archive.data_hash
            && decoder["wasm_sha256"] == receipt.archive.wasm_sha256,
        "Archive reference mismatch"
    );
    ensure!(
        artifacts::data_hash(&live_data(client, receipt.archive.out_point.clone())?)
            == receipt.archive.data_hash,
        "Referenced archive no longer matches"
    );
    let expected = cluster_data(&receipt.name, &receipt.description)?;
    ensure!(
        tx.outputs_data().get(0).map(|b| b.raw_data()) == Some(Bytes::copy_from_slice(&expected)),
        "Cluster metadata mismatch"
    );
    ensure!(
        live_data(client, receipt.cluster_out_point.clone())? == expected,
        "Cluster is not live with the expected data"
    );
    Ok(true)
}
pub fn verify(args: Verify) -> Result<()> {
    let receipt = serde_json::from_slice(&fs::read(args.receipt)?)?;
    ensure!(
        verify_receipt(&CkbRpcClient::new(&args.rpc), &receipt)?,
        "Cluster transaction is not yet committed"
    );
    println!("Cluster committed, live, and metadata verified.");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cluster_v2_molecule_id_and_cobuild_match_ccc_fixture() {
        let fixture: Value =
            serde_json::from_str(include_str!("../fixtures/spore-cluster-v2.json")).unwrap();
        let first = CellInput::new_builder()
            .previous_output(
                ckb_types::packed::OutPoint::new_builder()
                    .tx_hash(H256::from([0x22; 32]).pack())
                    .index(3u32)
                    .build(),
            )
            .build();
        let id = cluster_id(&first, 0);
        assert_eq!(format!("{id:#x}"), fixture["clusterId"].as_str().unwrap());
        let owner = Script::new_builder()
            .code_hash(SIGHASH_TYPE_HASH.pack())
            .hash_type(ScriptHashType::Type)
            .args(Bytes::from(vec![0x11; 20]).pack())
            .build();
        let data = cluster_data("Seedsong", &fixture["description"]).unwrap();
        assert_eq!(
            format!("0x{}", hex::encode(&data)),
            fixture["clusterData"].as_str().unwrap()
        );
        let output = cluster_output(&owner, &id, &data).unwrap();
        let ty = output.type_().to_opt().unwrap();
        assert_eq!(
            format!("{:#x}", ty.calc_script_hash()),
            fixture["typeHash"].as_str().unwrap()
        );
        assert_eq!(
            format!("0x{}", hex::encode(cobuild(&output, &data).unwrap())),
            fixture["cobuildWitness"].as_str().unwrap()
        );
        let capacity: u64 = output.capacity().unpack();
        assert_eq!(capacity, (data.len() as u64 + 126) * 100_000_000);
        assert_ne!(cluster_id(&first, 1), id);
    }
    #[test]
    fn description_keeps_standard_decoders_separate_from_zip_and_permissions() {
        let config = Config {
            owner: "fixture".into(),
            rpc: "fixture".into(),
            archive: DEFAULT_ARCHIVE.into(),
            name: "Seedsong".into(),
            description: "test".into(),
        };
        let archive = Archive {
            out_point: parse_out_point(DEFAULT_ARCHIVE).unwrap(),
            data_hash: "0x00".into(),
            wasm_sha256: "00".into(),
        };
        let doc = description(
            &config,
            &Script::default(),
            &archive,
            json!([["Mode"]]),
            json!([["IMAGE.0"]]),
        );
        assert_eq!(doc["dob"]["ver"], 1);
        assert_eq!(doc["dob"]["decoders"].as_array().unwrap().len(), 2);
        assert_eq!(doc["dob"]["decoders"][0]["decoder"]["hash"], DOB0);
        assert_eq!(doc["dob"]["decoders"][1]["decoder"]["hash"], DOB1);
        assert!(doc["dob"]["decoders"][0]["pattern"].is_array());
        assert_eq!(doc["seedsong"]["music"]["decoder"]["type"], "archive");
        assert_eq!(doc["seedsong"]["minting"]["mode"], "owner-authorized");
        assert!(parse_out_point("bad").is_err());
    }
}

#[path = "public_mint.rs"]
pub mod public_mint;
