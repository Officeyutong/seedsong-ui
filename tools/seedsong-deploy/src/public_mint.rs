//! Open the existing Seedsong Cluster using official ACP lock-proxy proofs.
//! No Cluster recreation, custom contract, backend signer or minting fee.
use super::*;

const ACP_CODE_HASH: &str = "0x3419a1c09eb2567f6552ee7a8ecffd64155cffe0f1796e6e61ec088d740c1356";
const SEEDSONG_ID: &str = "0xcac704319425b5ba589b62fb4df55307909c77db8a9ee5ead5d3e8bfaaa27abe";
const INITIAL_CLUSTER: &str =
    "0x23f41fabe26d45ef711ad8a1c2f169635cad16e5963f44df114b02694e1b2602:0";
#[derive(Args)]
pub struct Config {
    /// Current standard sighash owner, used through ckb-cli; never export its key.
    #[arg(long = "from")]
    pub owner: String,
    #[arg(long, default_value = "https://testnet.ckb.dev/")]
    pub rpc: String,
    /// Current live Cluster OutPoint; the original creation output is the default.
    #[arg(long, default_value = INITIAL_CLUSTER)]
    pub cluster: String,
    /// Reusable public authorization Cells; each occupies 61 CKB.
    #[arg(long, default_value_t = 4, value_parser = clap::value_parser!(u32).range(1..=64))]
    pub slots: u32,
}
#[derive(Args)]
pub struct Open {
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
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Receipt {
    schema: String,
    status: String,
    original_cluster: json::OutPoint,
    transaction_hash: H256,
    slots: u32,
    fee_shannons: u64,
    signed_transaction: json::Transaction,
}
struct Prepared {
    client: CkbRpcClient,
    point: json::OutPoint,
    old: CellOutput,
    data: Bytes,
    owner: Script,
    account: [u8; 20],
    public: Script,
    permit: CellOutput,
}
fn public_lock(owner: &Script) -> Result<Script> {
    ensure!(
        owner.args().raw_data().len() == 20,
        "Expected the owner's 20-byte key hash"
    );
    Ok(Script::new_builder()
        .code_hash(parse_hash(ACP_CODE_HASH)?.pack())
        .hash_type(ScriptHashType::Type)
        .args(owner.args())
        .build())
}
fn permit_output(lock: &Script) -> Result<CellOutput> {
    let output = CellOutput::new_builder().lock(lock.clone()).build();
    let capacity = output.occupied_capacity(Capacity::bytes(0)?)?.as_u64();
    Ok(output.as_builder().capacity(capacity).build())
}
fn prepare(config: &Config) -> Result<Prepared> {
    ensure!(
        (1..=64).contains(&config.slots),
        "Choose 1–64 public authorization Cells"
    );
    let client = CkbRpcClient::new(&config.rpc);
    crate::genesis(&client, Network::Testnet)?;
    let (owner, account) = crate::owner_lock(&config.owner, Network::Testnet)?;
    let point = parse_out_point(&config.cluster)?;
    let source =
        transaction(&client, &point.tx_hash)?.context("Cluster transaction must be committed")?;
    let old = source
        .outputs()
        .get(point.index.value() as usize)
        .context("Cluster output missing")?;
    ensure!(
        old.type_().to_opt() == Some(type_script(&parse_hash(SEEDSONG_ID)?)?),
        "Not the Seedsong Cluster V2 Cell"
    );
    let public = public_lock(&owner)?;
    ensure!(
        old.lock() != public,
        "This Cluster already uses public minting; do not repeat migration"
    );
    ensure!(
        old.lock() == owner,
        "This ckb-cli account does not own the Cluster's current lock"
    );
    let data = Bytes::from(live_data(&client, point.clone())?);
    ensure!(
        source
            .outputs_data()
            .get(point.index.value() as usize)
            .map(|data| data.raw_data())
            == Some(data.clone()),
        "Cluster data changed"
    );
    let permit = permit_output(&public)?;
    contract_dep(&client)?;
    Ok(Prepared {
        client,
        point,
        old,
        data,
        owner,
        account,
        public,
        permit,
    })
}
pub fn plan(config: Config) -> Result<()> {
    let state = prepare(&config)?;
    let slot_capacity: u64 = state.permit.capacity().unpack();
    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "schema": "seedsong-public-mint-plan/1", "network": "ckb_testnet",
            "clusterId": SEEDSONG_ID, "originalCluster": state.point,
            "publicLock": json::Script::from(state.public),
            "clusterDataHash": artifacts::data_hash(&state.data),
            "slots": config.slots, "slotCapacityShannons": slot_capacity,
            "additionalCapacityCkb": artifacts::ckb(slot_capacity * config.slots as u64),
            "note": "No transaction sent. Preserve Cluster ID, type, data and capacity; change only its lock, and fund reusable ACP authorization Cells. Public mints return their full capacity. The original key retains withdrawal/control rights."
        }))?
    );
    Ok(())
}
fn transfer_cobuild(from: &CellOutput, to: &CellOutput) -> Result<Vec<u8>> {
    let script = from.type_().to_opt().context("Missing Cluster type")?;
    let address = |lock: Script| {
        let mut bytes = 0u32.to_le_bytes().to_vec();
        bytes.extend(lock.as_slice());
        bytes
    };
    let transfer = table(&[
        script.args().raw_data().to_vec(),
        address(from.lock()),
        address(to.lock()),
    ])?;
    // SporeAction::TransferCluster union tag 4; WitnessLayout::SighashAll.
    let mut spore_action = 4u32.to_le_bytes().to_vec();
    spore_action.extend(transfer);
    let action = table(&[
        blake2b_256(b"CCC_DEFAULT_COBUILD_INFO").to_vec(),
        script.calc_script_hash().as_slice().to_vec(),
        bytes(&spore_action)?,
    ])?;
    let message = table(&[table(&[action])?])?;
    let mut witness = 0xff000001u32.to_le_bytes().to_vec();
    witness.extend(table(&[bytes(&[])?, message])?);
    Ok(witness)
}
pub fn open(args: Open) -> Result<()> {
    ensure!(
        !args.output.exists(),
        "Receipt exists; use cluster-open-verify before attempting another migration"
    );
    ensure!(args.fee_rate > 0, "Fee rate must be positive");
    let state = prepare(&args.config)?;
    let block = crate::genesis(&state.client, Network::Testnet)?;
    let deps = DefaultCellDepResolver::from_genesis(&block)?;
    let provider = DefaultTransactionDependencyProvider::new(&args.config.rpc, 32);
    let headers = DefaultHeaderDepResolver::new(&args.config.rpc);
    let mut collector = DefaultCellCollector::new(&args.config.rpc);
    if let Some(url) = &args.indexer_url {
        collector.indexer_client = IndexerRpcAsyncClient::new(url);
    }
    let new = state
        .old
        .clone()
        .as_builder()
        .lock(state.public.clone())
        .build();
    let placeholder = WitnessArgs::new_builder()
        .lock(Some(Bytes::from(vec![0; 65])).pack())
        .build();
    let mut base = TransactionBuilder::default()
        .input(
            CellInput::new_builder()
                .previous_output(state.point.clone())
                .build(),
        )
        .output(new.clone())
        .output_data(state.data.clone().pack())
        .cell_dep(contract_dep(&state.client)?)
        .cell_dep(
            deps.resolve(&state.owner)
                .context("Missing sighash dependency")?,
        )
        .witness(placeholder.as_bytes().pack());
    for _ in 0..args.config.slots {
        base = base
            .output(state.permit.clone())
            .output_data(Bytes::new().pack());
    }
    let base = base.build();
    let witness = transfer_cobuild(&state.old, &new)?;
    let balancer = CapacityBalancer::new_simple(state.owner.clone(), placeholder, args.fee_rate);
    let mut min_fee = 0;
    let mut final_tx = None;
    for _ in 0..8 {
        let (balanced, _) = balancer.rebalance_tx_capacity(
            &base,
            &mut collector.clone(),
            &provider,
            &deps,
            &headers,
            min_fee,
            None,
        )?;
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
        min_fee = required;
    }
    let tx = final_tx.context("Could not balance public mint migration fee")?;
    let signer = CliSigner {
        account: state.account,
        executable: args.ckb_cli,
        home: args.ckb_cli_home,
    };
    let mut unlockers: HashMap<ScriptId, Box<dyn ScriptUnlocker>> = HashMap::new();
    unlockers.insert(
        ScriptId::new_type(SIGHASH_TYPE_HASH.clone()),
        Box::new(SecpSighashUnlocker::from(Box::new(signer) as Box<_>)),
    );
    eprintln!(
        "Opening public minting for existing Cluster {SEEDSONG_ID}; {} authorization Cells, fee {} CKB. Signing through ckb-cli...",
        args.config.slots,
        artifacts::ckb(actual_fee(&tx, &provider)?)
    );
    let (tx, locked) = unlock_tx(tx, &provider, &unlockers)?;
    ensure!(locked.is_empty(), "Some migration inputs remain unsigned");
    verify_outputs(&tx, &state.old, &state.data, args.config.slots)?;
    ensure!(
        tx.inputs().get(0).map(|input| input.previous_output()) == Some(state.point.clone().into()),
        "Original Cluster input changed"
    );
    ensure!(
        tx.witnesses().get(tx.inputs().len()).map(|w| w.raw_data())
            == Some(Bytes::copy_from_slice(&witness)),
        "Migration CoBuild changed"
    );
    let hash: H256 = tx.hash().unpack();
    let mut receipt = Receipt {
        schema: "seedsong-public-mint/1".into(),
        status: "prepared".into(),
        original_cluster: state.point,
        transaction_hash: hash.clone(),
        slots: args.config.slots,
        fee_shannons: actual_fee(&tx, &provider)?,
        signed_transaction: json::TransactionView::from(tx).inner,
    };
    crate::save(&args.output, &receipt, true)?;
    let returned = state.client.send_transaction(receipt.signed_transaction.clone(), Some(json::OutputsValidator::Passthrough))
        .context("Submission uncertain: check the saved transactionHash using cluster-open-verify; do not create a replacement automatically")?;
    ensure!(returned == hash, "RPC returned another transaction hash");
    receipt.status = "submitted".into();
    crate::save(&args.output, &receipt, false)?;
    println!(
        "Cluster ID: {SEEDSONG_ID}\nPublic mint transaction: {hash:#x}\nReceipt: {}",
        args.output.display()
    );
    if args.wait_secs > 0 {
        let start = Instant::now();
        while !verify_receipt(&state.client, &receipt)? {
            ensure!(
                start.elapsed() < Duration::from_secs(args.wait_secs),
                "Submitted; confirmation timed out. Use cluster-open-verify, not a new migration."
            );
            thread::sleep(Duration::from_secs(3));
        }
        receipt.status = "committed".into();
        crate::save(&args.output, &receipt, false)?;
        println!("Public minting enabled and verified. Deploy the updated web UI to expose it.");
    }
    Ok(())
}
fn verify_outputs(tx: &TransactionView, old: &CellOutput, data: &Bytes, slots: u32) -> Result<()> {
    ensure!(
        (1..=64).contains(&slots),
        "Invalid authorization Cell count"
    );
    let public = public_lock(&old.lock())?;
    ensure!(
        tx.outputs().get(0) == Some(old.clone().as_builder().lock(public.clone()).build()),
        "Cluster fields or capacity changed"
    );
    ensure!(
        tx.outputs_data().get(0).map(|value| value.raw_data()) == Some(data.clone()),
        "Cluster metadata changed"
    );
    let permit = permit_output(&public)?;
    for index in 1..=slots as usize {
        ensure!(
            tx.outputs().get(index) == Some(permit.clone())
                && tx.outputs_data().get(index).map(|value| value.raw_data()) == Some(Bytes::new()),
            "Authorization output changed"
        );
    }
    Ok(())
}
fn verify_receipt(client: &CkbRpcClient, receipt: &Receipt) -> Result<bool> {
    ensure!(
        receipt.schema == "seedsong-public-mint/1",
        "Unsupported public mint receipt"
    );
    crate::genesis(client, Network::Testnet)?;
    let Some(tx) = transaction(client, &receipt.transaction_hash)? else {
        return Ok(false);
    };
    ensure!(
        json::TransactionView::from(tx.clone()).inner == receipt.signed_transaction,
        "Saved signed transaction differs from chain"
    );
    let previous = transaction(client, &receipt.original_cluster.tx_hash)?
        .context("Original Cluster transaction missing")?;
    let index = receipt.original_cluster.index.value() as usize;
    let old = previous
        .outputs()
        .get(index)
        .context("Original Cluster output missing")?;
    ensure!(
        old.type_().to_opt() == Some(type_script(&parse_hash(SEEDSONG_ID)?)?),
        "Not the Seedsong Cluster"
    );
    let data = previous
        .outputs_data()
        .get(index)
        .context("Original Cluster data missing")?
        .raw_data();
    verify_outputs(&tx, &old, &data, receipt.slots)?;
    ensure!(
        tx.inputs().get(0).map(|input| input.previous_output())
            == Some(receipt.original_cluster.clone().into()),
        "Receipt does not consume original Cluster"
    );
    let point = json::OutPoint {
        tx_hash: receipt.transaction_hash.clone(),
        index: 0.into(),
    };
    let live = client.get_live_cell(point, true)?;
    ensure!(
        live.status == "live",
        "Public Cluster is no longer live; inspect its current lock before claiming public minting is enabled"
    );
    let live = live.cell.context("Missing live Cluster")?;
    ensure!(
        CellOutput::from(live.output) == tx.outputs().get(0).unwrap(),
        "Live public Cluster differs"
    );
    // Original permit outputs may already be spent and recycled by public mints.
    Ok(true)
}
pub fn verify(args: Verify) -> Result<()> {
    let receipt = serde_json::from_slice(&fs::read(args.receipt)?)?;
    ensure!(
        verify_receipt(&CkbRpcClient::new(&args.rpc), &receipt)?,
        "Public mint migration is not yet committed"
    );
    println!(
        "Public mint migration committed; Cluster ID, metadata, ACP lock and authorization outputs verified."
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn owner() -> Script {
        Script::new_builder()
            .code_hash(SIGHASH_TYPE_HASH.pack())
            .hash_type(ScriptHashType::Type)
            .args(Bytes::from(vec![7; 20]).pack())
            .build()
    }
    #[test]
    fn public_lock_has_no_payment_minimum_and_permits_occupy_61_ckb() {
        let lock = public_lock(&owner()).unwrap();
        assert_eq!(lock.args().raw_data().len(), 20);
        assert_eq!(lock.args(), owner().args());
        assert_eq!(lock.code_hash(), parse_hash(ACP_CODE_HASH).unwrap().pack());
        let capacity: u64 = permit_output(&lock).unwrap().capacity().unpack();
        assert_eq!(capacity, 61u64 * 100_000_000);
    }
    #[test]
    fn migration_preserves_cluster_and_creates_exact_authorization_outputs() {
        let data = Bytes::from(b"immutable cluster metadata".to_vec());
        let old = cluster_output(&owner(), &parse_hash(SEEDSONG_ID).unwrap(), &data).unwrap();
        let lock = public_lock(&owner()).unwrap();
        let mut builder = TransactionBuilder::default()
            .output(old.clone().as_builder().lock(lock.clone()).build())
            .output_data(data.clone().pack());
        for _ in 0..4 {
            builder = builder
                .output(permit_output(&lock).unwrap())
                .output_data(Bytes::new().pack());
        }
        let tx = builder.build();
        verify_outputs(&tx, &old, &data, 4).unwrap();
        let modified = tx
            .as_advanced_builder()
            .set_outputs_data(vec![Bytes::from(b"changed".to_vec()).pack(); 5])
            .build();
        assert!(verify_outputs(&modified, &old, &data, 4).is_err());
        assert!(verify_outputs(&tx, &old, &data, 5).is_err());
    }
}

#[cfg(test)]
mod codec_fixture {
    use super::*;
    #[test]
    fn transfer_cobuild_matches_independent_ccc_codec() {
        let fixture: Value =
            serde_json::from_str(include_str!("../../../test/fixtures/public-mint.json")).unwrap();
        let owner = Script::new_builder()
            .code_hash(SIGHASH_TYPE_HASH.pack())
            .hash_type(ScriptHashType::Type)
            .args(Bytes::from(vec![7; 20]).pack())
            .build();
        let old = cluster_output(&owner, &parse_hash(SEEDSONG_ID).unwrap(), b"metadata").unwrap();
        let new = old
            .clone()
            .as_builder()
            .lock(public_lock(&owner).unwrap())
            .build();
        assert_eq!(
            format!("0x{}", hex::encode(transfer_cobuild(&old, &new).unwrap())),
            fixture["transferWitness"].as_str().unwrap()
        );
    }
}
