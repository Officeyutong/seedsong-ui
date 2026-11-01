# Seedsong Cell deployment

A standalone native Rust CLI using [CKB Rust SDK 5.1.0](https://github.com/nervosnetwork/ckb-sdk-rust/tree/v5.1.0). It always compresses the decoder and its companion files into one standard ZIP archive and publishes its bytes as a single ordinary data Cell. ZIP compression is mandatory; there is no raw-file deployment mode. It also creates a standard testnet Spore Cluster V2 using the already deployed archive and official DOB decoder references. Minting Spore records is not implemented by this tool yet.

The examples below run from the **seedsong-ui repository root**. You can also run `cargo run --release -- plan --from "$SEEDSONG_ADDRESS"` directly inside `tools/seedsong-deploy`.

The default base is the UI repository's `vendor/seedsong-base`, located relative to the crate's source directory recorded by Cargo at build time. It does not depend on the current working directory. Explicit relative paths supplied through `--base`, `--file`, `--output`, `--receipt`, and `--ckb-cli-home` are still resolved from the current working directory. Use `--base /path/to/seedsong-base` for another checkout or when moving a compiled executable away from its original source checkout.

## Requirements and build

- Current stable Rust and Cargo. Commit `Cargo.lock` to preserve the checked dependency versions.
- A C compiler, pkg-config, and OpenSSL development libraries on Linux (Debian/Ubuntu: `build-essential pkg-config libssl-dev`).
- For deployment: `ckb-cli` on PATH and an imported standard secp256k1-blake160 account. Its testnet address must have enough ordinary, mature CKB Cells to fund the deployment. Multisig, OmniLock, and derived-address signing are not implemented.
- For deployment and verification: CKB node RPC. Deployment also needs a synced CKB indexer; use `--indexer-url` if it is a separate endpoint.
- A freshly built Seedsong JS package. Pin the intended seedsong-base revision in this UI repository, then run `npm run setup`; its existing setup script restores the recorded submodule revision and builds the package. An older revision without `decoder.wasm` and `loader.js` cannot be used by the default deployment bundle. To work with an unpinned local checkout, build it directly and pass `--base /path/to/seedsong-base` instead.

```bash
cargo build --locked --manifest-path tools/seedsong-deploy/Cargo.toml
cargo run --locked --manifest-path tools/seedsong-deploy/Cargo.toml -- --help
```

`ckb-cli` keeps the private key in its keystore. The tool asks it to sign the SDK's 32-byte transaction digest using `util sign-message --recoverable`; it does not export private keys or accept them on the command line. Password entry is handled by ckb-cli through the terminal, and the returned signature is checked against the funding address. Hardware/plugin accounts work only if the plugin supports this signing operation; a standard local ckb-cli account is the supported path.

Find your public account address yourself with:

```bash
ckb-cli --local-only account list
```

The normal `CKB_CLI_HOME` environment variable is inherited. Override it with `--ckb-cli-home /path/to/ckb-cli-home`; override the executable with `--ckb-cli /path/to/ckb-cli`.

## Offline capacity plan

Set your public address (not a private key):

```bash
export SEEDSONG_ADDRESS='ckt1...'
cargo run --locked --manifest-path tools/seedsong-deploy/Cargo.toml -- \
  plan --from "$SEEDSONG_ADDRESS"
```

This command reads files and validates the owner address without contacting RPC or accessing the keystore. It prints the `bundle.zip` output's compressed size, SHA-256, CKB-personalized Blake2b data hash and occupied capacity. Its `archiveFiles` array lists each entry's original size and hashes. Fee and change are calculated only when funding inputs are selected during deployment.

The single artifact output is always index **0**, named `bundle.zip`. Funding change may create another output, but it contains no deployment artifact. The ZIP has these default entries:

| ZIP entry | Source |
| --- | --- |
| `decoder.wasm` | `wasm/seedsong-js/dist/decoder.wasm` |
| `loader.js` | `wasm/seedsong-js/dist/loader.js` |
| `decoder.json` | `wasm/seedsong-js/dist/decoder.json` |
| `spec.md` | Music v2 specification |
| `spec-v1.md` | Legacy music specification |
| `pattern.md` | DOB/0 and DOB/1 pattern specification |
| `bundle.json` | Generated archive manifest |

The manifest validates the build's WASM hash and size before deployment. Keep `loader.js`, WASM, and `decoder.json` from the same build because wasm-bindgen imports are build-specific. The default inline-WASM `index.js` is unnecessary on-chain: `loader.js` instantiates the raw decoder bytes retrieved from a Cell.

Files retain their original bytes inside the archive. The outer Cell data is a ZIP container using DEFLATE compression at level 9. Entry order, modification time (1980-01-01) and permissions are fixed, so identical inputs produce identical archive bytes with the locked compression dependencies. The archive is built in memory before signing; it is neither base64-encoded nor encrypted.

No type script is attached. The archive Cell is owned by the funding address and receives its exact minimum occupied capacity from the SDK, calculated from the **compressed ZIP size**. For the supported lock, a ZIP of N bytes occupies N + 61 CKB. One measured default bundle compressed to 159,758 bytes and occupied 159,819 CKB, compared with 471,563 CKB for the previous separate-file layout. This is a sample, not a fixed size: inspect your actual plan after rebuilding. Capacity remains locked in the Cell; fees and funding change are separate. ZIP storage does not mean the uncompressed decoder meets the proposal's original 60 KB binary limit.

Add files with `--file NAME=PATH` (repeatable). Names must be unique and contain only letters, digits, dots, dashes or underscores. `bundle.json` and `bundle.zip` are reserved. To upload a custom set instead of the default bundle:

```bash
cargo run --locked --manifest-path tools/seedsong-deploy/Cargo.toml -- \
  plan --from "$SEEDSONG_ADDRESS" --no-defaults \
  --file decoder.wasm=./my-decoder.wasm \
  --file loader.js=./matching-loader.js
```

The same file options apply to `deploy`. Even `--no-defaults` always creates a ZIP containing the selected entries and `bundle.json`. There is no `--zip` flag because compression is unconditional. Very large compressed bundles can exceed node transaction/block limits; use separate, smaller custom ZIP deployments and keep their receipts. The tool does not automatically split transactions.

## Deploy

This command signs and broadcasts a transaction. There is no additional confirmation prompt beyond ckb-cli's account password prompt:

```bash
cargo run --locked --manifest-path tools/seedsong-deploy/Cargo.toml -- \
  deploy --from "$SEEDSONG_ADDRESS" \
  --network testnet \
  --rpc http://127.0.0.1:8114 \
  --output deployments/testnet-decoder.json
```

Use `--indexer-url http://127.0.0.1:8116` if necessary. `--fee-rate` defaults to 1,000 shannons per 1,000 bytes. `--wait-secs` defaults to 180; zero returns after submission. `--network` defaults to `testnet`. Mainnet requires `--network mainnet` and a mainnet address. Public network genesis hashes are checked before signing; dev chains require `--network dev` and a testnet-prefix address. A dev chain must include the standard sighash lock in its genesis.

The SDK selects ordinary empty-data, untyped funding Cells, adds the sighash dependencies, calculates the fee, and returns change to the same owner. The deployed nonempty ZIP Cell is not selected as an ordinary funding input by later invocations. The tool checks that balancing has preserved the archive at output index 0, its data and its capacity before broadcasting.

The local receipt records:

- The exact signed transaction and expected transaction hash, written **before** broadcast.
- Node network, genesis hash, owner, transaction byte size and actual fee.
- The archive's OutPoint, occupied capacity, compressed byte count, SHA-256 and CKB data hash.
- Every ZIP entry's original byte count and hashes, including `bundle.json`.
- Status: `prepared`, `submitted`, or `committed`. Updates use atomic file replacement.

A deployment never overwrites an existing receipt. Choose a new `--output` for a new deployment. If broadcast fails or times out, it may still have reached the node. Inspect the saved `transactionHash` before rerunning deployment. `signedTransaction` is retained so the same transaction can be resubmitted with RPC if needed; broadcasting it again does not create a new transaction. A new deploy command would select inputs and construct a separate transaction.

## Verify and retrieve

```bash
cargo run --locked --manifest-path tools/seedsong-deploy/Cargo.toml -- \
  verify --receipt deployments/testnet-decoder.json \
  --rpc http://127.0.0.1:8114
```

Verification checks the genesis hash, commitment status, complete transaction against the signed receipt, archive hashes and capacity, and whether the archive Cell is still live. It also decompresses entries in memory and checks their count, sizes and hashes against the receipt; it never extracts paths onto disk. Legacy `seedsong-deployment/1` receipts remain verifiable, but all new deployments use ZIP-only `seedsong-deployment/2` receipts. It returns an error for pending/unknown, rejected, spent, or mismatching results. Verification is read-only and does not change the receipt's cached status; the chain result is authoritative. Commitment is an observation at the current tip, not a guarantee against future reorganization.

The internal `bundle.json` uses schema `seedsong-archive/1`. It lists the other ZIP entries by name, original size and hashes. These names are **archive paths, not Cell OutPoints or output indices**. It omits its own hash to avoid recursion; the local receipt covers the complete ZIP and every entry, including the manifest. Record the single archive OutPoint in collection metadata.

For later light-client integration:

1. Retrieve the archive Cell and verify its on-chain data hash.
2. Unzip its bytes in memory using a standard ZIP reader (for example `fflate` in a browser), then read `bundle.json` and verify the entry hashes.
3. Load the matching `loader.js` ESM and pass the extracted `decoder.wasm` bytes to its `loadSeedsong` function. If importing on-chain JS through a Blob module, the application must permit that loading policy.
4. Parse the DOB arrays from the extracted `pattern.md` and pass them to `decodeDob0` and `decodeDob1`; music generation uses the same loaded library.

**The current JS loader accepts raw WASM, not ZIP bytes.** Archive decompression is the responsibility of the application that retrieves the Cell. Do not pass `bundle.zip` directly to `loadSeedsong`. There are no separate WASM or manifest Cells in the new layout.

The owner can spend these standard-lock data Cells, releasing their occupied capacity. Keep the deployment account and preserve these Cells while they are referenced. Existing records should retain their exact version and OutPoints when deploying a new decoder. This tool stores WASM as **data** for execution in the browser; it does not deploy a CKB-VM executable contract.

## Local checks

```bash
cargo test --locked --manifest-path tools/seedsong-deploy/Cargo.toml
cargo clippy --locked --manifest-path tools/seedsong-deploy/Cargo.toml --all-targets -- -D warnings
```

Unit tests use synthetic keys and local fixtures. They check signature parsing/recovery, capacity calculation, manifest construction, ZIP round-trip and determinism, archive tampering detection, and bundle validation without accessing real accounts or sending transactions. Actual network deployment requires running the explicit deploy command with your funded account.


## Create the Seedsong Spore Cluster

These commands support **CKB testnet**. They read the committed, live archive,
validate all file hashes and the WASM build manifest, and extract the exact
DOB/0 and DOB/1 arrays from the archived `pattern.md`. Local edits to patterns
are not used. The live Cluster V2 contract Cell is checked against its official
code hash before building or signing.

From `tools/seedsong-deploy`, inspect the metadata and occupied capacity:

```bash
cargo run --release --locked -- cluster-plan --from "$SEEDSONG_ADDRESS"
```

From the UI root, prefix the command with
`cargo run --release --locked --manifest-path tools/seedsong-deploy/Cargo.toml --`.
Both commands default to:

- RPC: `https://testnet.ckb.dev/` (override with `--rpc`).
- Archive: `0x4d54a43844847bd053b8cedf6bf70deb5cdb5904a43378f6db7c4426887a22ba:0`
  (override with `--archive TX_HASH:INDEX`).
- Name: `Seedsong` (override with `--name`).
- Minting policy: owner authorization through the current Cluster lock; no
  public mint proxy is created. The metadata records the initial owner lock
  hash for provenance, not as a replacement for the current on-chain lock.

The plan is read-only and does not access the account key. It displays the
full JSON description, original archive reference, official Cluster contract,
and minimum occupied capacity. The Cluster ID is intentionally null: it is
only determined after selecting the first funding input for the actual creation
transaction. The default metadata occupies approximately 7,100 CKB; inspect the
current plan for the exact amount, excluding fees and funding change.

Explicitly create and broadcast:

```bash
cargo run --release --locked -- cluster-create --from "$SEEDSONG_ADDRESS" \
  --output ./cluster-receipt.json
```

Enter the ckb-cli account password locally if prompted. `--indexer-url`,
`--fee-rate`, `--ckb-cli`, `--ckb-cli-home` and `--wait-secs` have the same meanings
as for archive deployment. The tool derives the Cluster ID from the first
input's complete serialized CellInput plus output index 0, encodes
ClusterDataV2, generates the CreateCluster CoBuild action, and balances fees
including the final extra witness before signing. It never spends the archive
Cell. Only ordinary mature empty-data, untyped funding Cells are selected.

The receipt is written before broadcast and records the Cluster ID, type hash,
OutPoint, complete JSON description, archive reference, occupied capacity,
actual fee and signed transaction. A failed/uncertain submission leaves the
prepared receipt in place; check its transaction hash rather than creating a
second Cluster. Successful creation prints the actual Cluster ID and hash.

Verify it later:

```bash
cargo run --release --locked -- cluster-verify --receipt ./cluster-receipt.json
```

This checks the testnet genesis, committed transaction against the receipt,
Cluster ID derivation, type script/hash, owner, capacity, encoded metadata,
Cluster liveness and the referenced archive's liveness/data hash.

The standard Cluster description contains exactly two `dob.decoders` entries
under `dob.ver: 1`: official DOB/0 followed by official DOB/1. Patterns are JSON
arrays within the JSON description string. The Seedsong extension separately
references the ZIP OutPoint and data hash, WASM and loader entry names, ABI,
document entries and music specification. Music WASM is not a third standard
DOB decoder.

The decoder archive remains a mandatory ZIP data Cell. **The Cluster Cell is
uncompressed standard Spore Molecule data**, because wallets and official DOB
services must read its name and JSON description directly. These are different
protocol objects; the archive uploader's ZIP-only rule has not changed.

This command does not mint the 50 M2 records, prove official SVG output parity,
or establish wallet/explorer rendering compatibility. Those remain separate
acceptance steps. The fixture in [fixtures](fixtures/README.md) independently
checks wire encoding against CCC, not the official SVG renderer.
