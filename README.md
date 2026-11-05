# Seedsong UI

An English-language React and Material UI studio for creating SVG artwork and 16-bar stereo music from 32-byte DNA. All rendering runs locally in the browser; audio synthesis runs in a dedicated Web Worker.

## Requirements

- Node.js 22+ and npm
- Git
- Rust with the `wasm32-unknown-unknown` target
- wasm-pack (`cargo install wasm-pack --locked`)

## Setup

```bash
git clone --recurse-submodules <this-repository>
cd seedsong-ui
rustup target add wasm32-unknown-unknown
npm run setup
npm run dev
```

`setup` initializes the pinned `vendor/seedsong-base` submodule, installs its build dependencies, builds `wasm/seedsong-js`, and installs the UI dependencies. The application consumes the package through the `seedsong-js` dependency; it does not import Rust bindings directly. `package-lock.json` is ignored by project convention.

If the repository is already checked out, `npm run setup` performs the same initialization. A regular `npm install` does not build the Rust dependency; run setup first on a fresh checkout.

```bash
npm run build
npm run preview
npm run lint
npm test
npm run test:browser
```

Browser tests open a visible browser. Install the browser once with `npx playwright install chromium`; a graphical display is required. The browser test does not use headless mode.

## Features

- Paste and validate hex DNA, including optional prefixes and separators.
- Generate random DNA using the music library.
- Edit DNA through five stages, preserving unrelated bytes and bitfields.
- Preview SVG artwork and musical traits from the pinned DOB/0 and DOB/1 patterns.
- Choose the bundled decoder or a ZIP Cell loaded through a configurable CCC RPC client.
- Render covers and WAV in a Worker, with cancellation, loading states, and stale-result detection.
- Play, seek, change volume, loop, and download audio.
- Select music v2 (default) or legacy v1 for reproducible playback and comparison.
- Download the exact SVG string and a DNA text file containing the music version and render settings.
- Connect a CCC wallet and mint the current DNA into the deployed testnet Spore Cluster.
- Generate, edit and mint batches of up to 50 unique DNA values in one atomic transaction.
- Review capacity and fees, export signed receipts, check confirmation and recover uncertain submissions.
- Responsive layouts, keyboard-accessible controls, light and dark themes.

DNA exports describe the current DNA and sound settings. After a matching render, their music version comes from the returned WAV metadata. If you edit DNA or settings, the previous audio is marked stale and its WAV download is disabled; the DNA export describes the new settings awaiting rendering. To recreate an export, paste its `dna` and restore its `settings`, including `musicVersion`, in Sound settings.

The initial DNA is the specification's reference example. Audio rendering starts only when requested. The DNA-selected timbre remains a collectible trait even when the piano playback override is selected.

## Dependency and protocol updates

`vendor/seedsong-base` is a Git submodule. Commit its Git link to pin the music code and specifications together. To upgrade, check out the intended upstream commit in that directory, run `npm run setup`, review the runtime patterns and regression tests, and commit the updated Git link. The submodule Git link pins the library and both specifications together.

With the bundled source, the application fetches the pinned `pattern.md` at runtime and parses its DOB/0 and DOB/1 JSON arrays. Vite serves the document as a local asset, so production uses the same document without a remote API. Loading and retry controls include a button Loader. There is no synchronization script or generated pattern source. `spec.md` defines the music byte allocation. The active Rust/WASM library generates SVG covers and music in a Worker. The UI also reads the active patterns to edit DNA fields and show immediate trait previews.

## Source layout

- `src/app/views`: header, creation workflow, and help page.
- `src/app/common`: runtime pattern loading, DNA editing, DOB decoding, downloads, and shared types.
- `src/app/decoder`: source settings, CCC archive loading, integrity checks, Worker ownership and document URLs.
- `src/app/mint`: CCC wallet UI and typed DNA generation, transaction preparation, signing and recovery APIs.
- `src/app/hooks`: rendering callbacks and Blob URL cleanup.
- `src/app/workers`: typed audio rendering protocol and Worker entry.
- `scripts`: Git submodule and music library setup.
- `test`: protocol and visible-browser integration tests.

The application is a static site. On-chain decoder loading uses CCC JSON-RPC requests to the selected endpoint; the bundled source requires only the site's static assets. Production output in `dist/` includes the JS/WASM engine and Worker; the deployed host needs no Rust toolchain or audio backend. The Mint tab loads the CCC wallet connector on demand and submits user-approved testnet transactions.

## Automated build and publication

[Build and publish to deploy](.github/workflows/publish-deploy.yml) runs on every push to `main`. It can also be started manually from the Actions tab when `main` is selected.

The workflow checks out the pinned submodules, installs Linux build dependencies, Node.js 24, stable Rust, the `wasm32-unknown-unknown` target, and wasm-pack. It then runs `npm run setup` to build `seedsong-js` from source and install UI dependencies before running `npm run build`. No prebuilt local WASM files or npm lockfiles are required.

After a successful build, the workflow publishes the contents of `dist/` at the root of `deploy`, including the Worker and specification assets. `deploy` is reserved for build output: files absent from the new build are removed, and existing publication history is preserved. The branch is created on the first publication if it does not already exist. Failed builds do not publish, and newer runs cancel older runs.

Publication uses [actions-gh-pages](https://github.com/peaceiris/actions-gh-pages) with the built-in `GITHUB_TOKEN` and job-level `contents: write` permission. No additional token secret is required. Repository rules for `deploy` must permit the workflow's publication commits. This workflow updates the artifact branch; it does not configure a hosting provider or run the test suites.


## On-chain artifact deployment

[tools/seedsong-deploy](tools/seedsong-deploy/README.md) is an independent native Rust program using the CKB Rust SDK. It always compresses the raw WASM decoder, matching JS loader, build metadata, specifications and an archive manifest into one `bundle.zip`, stored in a single data Cell. Compression is mandatory. The local receipt records its OutPoint and both archive and entry hashes; readers must unzip the Cell data before loading WASM. It signs through an existing ckb-cli account without exporting private keys.

From this repository root, after pinning and building a seedsong-base revision that includes the decoder artifacts:

```bash
# Offline plan: inspect file hashes and exact occupied capacity.
cargo run --locked --manifest-path tools/seedsong-deploy/Cargo.toml -- \
  plan --from "$SEEDSONG_ADDRESS"

# Explicitly sign and broadcast on testnet.
cargo run --locked --manifest-path tools/seedsong-deploy/Cargo.toml -- \
  deploy --from "$SEEDSONG_ADDRESS" --rpc http://127.0.0.1:8114 \
  --output deployments/testnet-decoder.json
```

Set `SEEDSONG_ADDRESS` to the public testnet address of your funded ckb-cli account. Deployment needs node RPC and a synced indexer; a separate endpoint can be supplied with `--indexer-url`. The tool defaults to testnet and verifies the node genesis hash. The `verify` command checks commitment, file hashes and Cell liveness against a saved receipt. See the tool README for account configuration, additional file uploads and recovery after interrupted submissions. The tool also provides `cluster-plan`, `cluster-create`, and `cluster-verify` for a standard testnet Spore Cluster V2 referencing the released ZIP and official DOB decoders. Cluster creation signs through ckb-cli; minting Spore records remains separate.


## Decoder sources and CCC RPC

Open **Decoder source** above the creation tabs. The default is **Bundled with this website**, preserving the engine and specifications shipped with the pinned seedsong-base package. The bundled WASM is loaded lazily as a Worker chunk when that source initializes.

Choose **Load from a CKB Cell** to configure:

- RPC endpoint: defaults to `https://testnet.ckb.dev/`. CCC's `ClientPublicTestnet.open({ urls: [rpcUrl] })` uses exactly this endpoint, without falling back to another provider. HTTP and HTTPS URLs are supported; custom endpoints must permit browser CORS access. HTTPS pages normally cannot use plain HTTP endpoints other than browser-permitted local exceptions.
- Decoder transaction hash: defaults to `0x4d54a43844847bd053b8cedf6bf70deb5cdb5904a43378f6db7c4426887a22ba`.
- Output index: defaults to `0`. A `hash:index` value in the hash field also works and overrides the separate index.

**Load selected source** applies changes explicitly. The successful selection is saved in localStorage and restored on reload. Download, ZIP decompression, hashing, JS/WASM initialization, cover generation, and WAV rendering run in Workers. Loading buttons display progress and can be cancelled. A failed or cancelled replacement keeps the previously active decoder and its documents. There is no silent fallback from a failed on-chain source to the bundled engine. If a saved endpoint becomes unavailable, select the bundled source to recover.

The loader checks the transaction hash and commitment, Cell liveness, archive schema/ABI, every file's SHA-256 and CKB data hash, and the WASM build manifest before importing downloaded JS. It accepts `seedsong-archive/1` ZIPs with decoder ABI 1 and the Seedsong v1 pattern format understood by the editor. ZIP input is limited to 8 MiB, with at most 64 entries and 16 MiB of expanded content. The ZIP must include `bundle.json`, `decoder.wasm`, `loader.js`, `decoder.json`, `pattern.md`, `spec.md`, and `spec-v1.md`.

The matching JS loader is imported from the archive, so a custom transaction can carry its own wasm-bindgen glue. It is not required to match the locally bundled WASM. The documents linked in **Guide** are Blob URLs made from the active source's actual texts. Switching sources updates the editor patterns and links together, and marks previously rendered audio stale until regenerated. DNA exports include decoder provenance (RPC, OutPoint and archive/WASM hashes for the chain source).

A cancelled audio render terminates the Worker. The already checked package is retained in memory and used to restart the Worker without repeating the RPC download. Source changes dispose the previous Worker and document URLs. Browser policies must allow Worker modules, `blob:` module imports and WASM compilation. No cross-origin isolation is needed.

Decoder loading uses `@ckb-ccc/core` as an RPC client and `fflate` to read standard ZIPs. Wallet minting additionally uses `@ckb-ccc/connector-react` and `@ckb-ccc/spore`. Neither implements light-client verification here. Loading a decoder sends only transaction/Cell references; minting publishes the selected DNA on chain. The source's archive hash is displayed for identification; the chosen RPC still supplies chain status and headers.


### Seedsong Cluster creation

The native deployment tool reads patterns directly from the committed archive and supports owner-authorized minting through the Cluster's standard lock. From `tools/seedsong-deploy`:

```bash
cargo run --release --locked -- cluster-plan --from "$SEEDSONG_ADDRESS"
cargo run --release --locked -- cluster-create --from "$SEEDSONG_ADDRESS" --output ./cluster-receipt.json
cargo run --release --locked -- cluster-verify --receipt ./cluster-receipt.json
```

The RPC defaults to the public testnet endpoint and the archive defaults to the released ZIP OutPoint. Cluster data uses standard uncompressed Spore Molecule encoding; the ZIP-only rule still applies to the decoder archive. See the [deployment tool documentation](tools/seedsong-deploy/README.md#create-the-seedsong-spore-cluster) for permissions, capacity, CoBuild encoding and recovery after uncertain submissions. These commands do not mint the 50 test records.


## Mint records from the browser

Open **Mint**, or choose **Mint this DNA** in Create. Connect a wallet through CCC, choose **Current DNA** or **Batch mint**, then **Prepare records**. Batch mode generates 1–50 unique random DNA values through the active Seedsong Worker; you can edit the list or paste one DNA per line. Preparation does not sign or broadcast. Review the recipient, Spore IDs, occupied record capacity and estimated fee before **Sign and mint**. The complete batch is atomic and needs one transaction approval. Buttons show progress during asynchronous operations.

Minting currently targets this deployed testnet Cluster:

```text
0xcac704319425b5ba589b62fb4df55307909c77db8a9ee5ead5d3e8bfaaa27abe
```

The existing Cluster can be opened to every funded testnet wallet using the migration below. The UI inspects its current on-chain lock: before migration, only the owner can mint; after migration, it uses the official Anyone-Can-Pay (ACP) lock and a reusable public authorization Cell. No creator co-signature, signing backend or additional minting fee is required. The wallet funds its own records and network fee. The public Cell's lock, data and full capacity are returned unchanged, and the Cluster is referenced as a dependency without being spent. Single and batch minting share this permission path.

Public authorization Cells can be used by one transaction at a time. If another mint consumes the selected Cell before signing, prepare a fresh transaction. A conflict after signing may be rejected by the node: check the saved transaction's status before preparing another mint. There is no automatic replacement or duplicate batch submission.

**Minting RPC endpoint** defaults to `https://testnet.ckb.dev/`. **Apply RPC** checks the testnet genesis before replacing the client. It is separate from the decoder-download RPC. Reconnect the wallet if its client has not followed the change. Custom endpoints need browser CORS support. Only the selected RPC is used. Private keys stay in the connected wallet.

Each record is a Spore V2 with `content_type = "dob/1"`, the collection's Cluster ID and UTF-8 JSON content `{"dna":"<64 lowercase hex characters>"}`. The Cluster supplies the DOB patterns and music v2 decoder release; audio files and WASM are not duplicated in each record. Playback overrides, reverb and legacy v1 settings are not part of mint content. The active decoder's WASM hash must match the Cluster release, and chain sources must also match its archive hash. Load the deployed ZIP if the bundled build differs.

The browser saves the full signed transaction before sending it. **Mint receipts** lists transaction hashes, DNA, Spore IDs and statuses. Use **Check transaction status** to refresh confirmation and Explorer links after broadcast. If RPC submission times out, use **Resubmit signed transaction**: it checks the original hash and only resends the saved bytes. It never generates a replacement batch. Export receipts for backup; clearing browser storage removes local recovery data. Storage failure prevents the initial broadcast. Preparation/generation can be cancelled; reject a pending signature in your wallet.

### Batch API

The UI-independent TypeScript API is [src/app/mint/api.ts](src/app/mint/api.ts). It accepts ordinary DNA strings and a CCC `Signer` rather than wallet-specific objects:

```ts
import {
    generateBatchDna, prepareMint, signAndSubmitMint,
    saveMintReceipt, checkMint, resubmitMint,
} from "./src/app/mint/api";

const dnas = await generateBatchDna(50, {
    randomDna: () => decoder.engine.randomDna(),
    signal: abortController.signal,
    onProgress: console.info,
});
const plan = await prepareMint(signer, dnas, decoder.info.package.reference, {
    feeRate: 1000n, // shannons per 1000 bytes
    signal: abortController.signal,
    onProgress: console.info,
});
// Show plan.records, recipient, recordCapacity and fee before approval.
const receipt = await signAndSubmitMint(plan, {
    persist: saveMintReceipt, // synchronous durable storage; called BEFORE broadcast
    onProgress: console.info,
});
const latest = await checkMint(receipt); // no signing or broadcast
// Only for an uncertain submission, after explicit user action:
// await resubmitMint(latest, { persist: saveMintReceipt });
```

`generateBatchDna` can omit `randomDna` to use browser `crypto.getRandomValues`. It rejects invalid counts, malformed DNA and an excessively repetitive random source. `normalizeDnas` canonicalizes a supplied batch and rejects duplicates. `prepareMint` validates the network, live Cluster, owner permission and decoder provenance, then completes funding and fees. Neither function signs. `signAndSubmitMint` rejects a wallet-modified raw transaction and validates every reviewed DNA, Cluster and Spore ID. Receipts use `seedsong-mint/1`; capacities and fees are decimal shannon strings, and `signedTransaction` is the exact Molecule-serialized signed transaction as hex.

New offline regression cases are in `test/mint.test.ts`; run them with the existing `npm test` command. Wallet/browser and live minting checks require your own funded authorized wallet. No transaction is submitted by the build or test scripts.


### Enable public minting for the existing collection

This is a one-time **on-chain migration** signed by the current Cluster owner.
Deploying the website alone cannot change the Spore contract's authorization.
It preserves the Cluster ID, type, immutable metadata, decoder references,
capacity and membership of the existing 50 records. The lock changes to the
official testnet ACP lock using the same owner's 20-byte public-key hash, with
no minimum-payment arguments. The original key retains control/withdrawal rights;
ordinary users can only recycle authorization Cells without withdrawing funds.

From the UI repository root, use the existing ckb-cli account:

```bash
# Read-only plan; no signing or transaction submission.
cargo run --release --locked --manifest-path tools/seedsong-deploy/Cargo.toml -- \
  cluster-open-plan --from "$SEEDSONG_ADDRESS"

# Sign, save the transaction receipt, broadcast and verify confirmation.
cargo run --release --locked --manifest-path tools/seedsong-deploy/Cargo.toml -- \
  cluster-open --from "$SEEDSONG_ADDRESS" \
  --output deployments/testnet-public-mint.json

cargo run --release --locked --manifest-path tools/seedsong-deploy/Cargo.toml -- \
  cluster-open-verify --receipt deployments/testnet-public-mint.json
```

The default source is the original Seedsong Cluster creation output. Supply
`--cluster TX_HASH:INDEX` if it moved before this migration. The command refuses
an unrelated Cluster, a non-owner account, a spent source, an already opened
Cluster, or overwriting an existing receipt. It is testnet-only.

The default `--slots 4` creates four untyped, empty-data authorization Cells of
61 CKB each, requiring **244 additional CKB plus the migration fee** from the
administrator. This is reusable setup capacity, not a per-mint charge. Slots may
be chosen from 1–64. Any user can fund additional untyped, empty-data Cells at
the exact public lock to increase availability; existing slots are recycled by
mints. Custom RPC/indexer and ckb-cli paths are supported as in Cluster creation.

Deploy the updated website and run the migration, then connect an unrelated
funded wallet and prepare a mint. Its preview shows **Public mint · Any wallet**.
Check both single and batch minting and confirm the record recipient is the
connected wallet. The signed Cluster creation description's owner-only fields
record the original configuration; current mint permission follows the live
lock, which this UI inspects. Record the migration transaction alongside the
Cluster creation receipt. `cluster-open-verify` verifies the new state; the old
creation verifier expects the original Cell to remain live.

If submission times out, use the saved receipt's hash and
`cluster-open-verify` before taking another action. The receipt contains the
exact signed transaction for recovery. An RPC timeout is not proof of rejection.
See the native tool README for command details. No migration is executed by the
website build, tests or setup script.
