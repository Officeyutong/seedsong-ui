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
- Choose the bundled decoder or a ZIP Cell fetched and verified through light-client P2P.
- Configure testnet WSS peers and view verified tip/script synchronization progress.
- Render covers and WAV in a Worker, with cancellation, loading states, and stale-result detection.
- Play, seek, change volume, loop, and download audio.
- Browse wallet-owned Seedsong records in Gallery, with chain-backed ownership, covers and playback.
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
- `src/app/chain`: shared light-client lifecycle, synchronization status, CCC adapter and receipt codecs.
- `src/app/decoder`: source settings, P2P archive loading, integrity checks, Worker ownership and document URLs.
- `src/app/mint`: CCC wallet UI and typed DNA generation, transaction preparation, signing and recovery APIs.
- `src/app/hooks`: rendering callbacks and Blob URL cleanup.
- `src/app/workers`: typed audio rendering protocol and Worker entry.
- `scripts`: Git submodule and music library setup.
- `test`: protocol and visible-browser integration tests.

The application is a static site. Browser chain reads and transaction broadcasts
use `@nervosnetwork/ckb-light-client-js` over WSS P2P, with no public RPC or indexer
fallback. The bundled music source requires only static assets. Wallet signing
uses CCC against the light-client adapter; keys stay in the connected wallet.

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


## Browser light client and decoder sources

The application temporarily installs the checked-in PR #308 `@nervosnetwork/ckb-light-client-js`
**0.5.5-pr308.fef3c51** archive (see `vendor/ckb-light-client/README.md`) and its required
`@ckb-ccc/core` **0.1.0-alpha.6**. Matching Spore and React connector packages are
**0.1.0-alpha.4** and **0.0.17-alpha.10** respectively. `npm ls @ckb-ccc/core --all`
should show one core version throughout. Browser Buffer/process/stream support
is configured for these alpha SDKs, without forcing incompatible modern packages
onto the older core.

Open **Settings → CKB light client** to configure WSS peer multiaddresses and connect. A
chain operation also starts the node automatically. Its panel shows peers, the
locally verified tip, peer-proved target, subscribed script count and scan height.
Stop the client before changing peers. Chain data is persisted in browser storage;
a Web Lock prevents multiple Seedsong tabs from opening the database concurrently.
Close or stop the other tab first. The local P2P identity is not a wallet key.

### Required hosting headers

Use HTTPS or localhost and a current browser supporting SharedArrayBuffer,
Atomics.waitAsync and Web Locks. Vite dev/preview and [public/_headers](public/_headers)
configure:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

`require-corp` is an alternative COEP value. `window.crossOriginIsolated` must be
true. Vite copies `public/_headers` to `dist/_headers`; CI verifies that the
published copy matches the source. The `/*` rule covers HTML, Workers and assets
on both Pages preview URLs and custom domains.

For this repository's prebuilt `deploy` branch, configure **Cloudflare Pages**:

- Production branch: `deploy`.
- Framework preset: None.
- Root directory: repository root.
- Build command: `exit 0` (the branch already contains the built site).
- Build output directory: `.` (the branch root, containing `index.html` and `_headers`).

If building from source instead, the build output directory is `dist`. Do not
publish `public/` or point Pages at `dist` when deploying the already-built
`deploy` branch. Pages parses `_headers` as configuration; fetching `/_headers`
is not a way to test it. After redeployment, inspect the **document response** in
DevTools and evaluate `window.crossOriginIsolated` and `typeof SharedArrayBuffer`
in the page console; the expected values are `true` and `"function"`.

These rules apply to Pages static responses. Responses generated by Pages
Functions or an advanced-mode `_worker.js` need the same headers set in that
code; no Pages Functions are used by this app. See the
[Pages headers documentation](https://developers.cloudflare.com/pages/configuration/headers/).
Configure these headers at another host too and reload after deployment. Without isolation,
chain operations display an error and never fall back to RPC. Cross-origin
isolation affects popup opener relationships: manually verify popup-based wallet
flows, or use a compatible wallet extension. Wallet providers may use their own
signing/authentication services; application chain reads do not use them as an RPC.

### Synchronization and queries

One shared node owns the light-client network/database Workers. The adapter adds
full lock/type subscriptions with serialized `setScripts` Partial updates,
retaining previous subscriptions and persisted scan progress. New scripts scan
from the configured inclusive start height; use 0 to include older wallet funding. First-time scans can take several
minutes. Queries wait for the relevant script to reach the peer-proved/local
verified target instead of reporting an unsynchronized empty result as no assets.
A scan continues after a query timeout; retry when it catches up.

Transaction data comes from `fetchTransaction` proofs. A creation proof alone
does not establish liveness: the adapter additionally finds the exact OutPoint in
synchronized `getCells` output. Funding selection does not yield stale CCC-cache
entries before this scan. Locally submitted inputs are excluded; fresh change
becomes selectable after confirmation. Only exact full-script queries are
supported; arbitrary prefix discovery and unavailable full-block methods fail
explicitly. Explicitly selected fee rates are used; the fallback fee estimate is
1000 shannons/1000 bytes without an external statistics API.

Before local cycle checking/broadcast, dependency and input transactions,
including dep-group members, are fetched through P2P. Wallet signatures are saved
before `sendTransaction` enqueues through the light client. A returned hash
confirms local queueing only; it does not confirm remote peer acceptance. The local pending
cache is not a complete view of every peer's mempool; concurrent public mints can
still conflict. Check status before retrying, and only resubmit the saved bytes.
Legacy receipt RPC URLs are retained as provenance and never requested.

### Decoder ZIP loading

**Settings → Decoder source** retains the bundled engine and **Load from a CKB Cell**. The
chain option accepts a transaction hash and output index (or `hash:index`), with
no RPC field. The default is still
`0x4d54a43844847bd053b8cedf6bf70deb5cdb5904a43378f6db7c4426887a22ba:0`.
Saved legacy endpoint settings are discarded. The shared node verifies the
committed transaction and liveness, then the independent music Worker unpacks and
checks the ZIP before importing its exact JS loader and WASM. Limits remain 8 MiB
compressed, 64 entries and 16 MiB expanded; schema, ABI, entry hashes and the WASM
manifest are checked. Required files remain `bundle.json`, `decoder.wasm`,
`loader.js`, `decoder.json`, `pattern.md`, `spec.md`, and `spec-v1.md`.

Success switches the engine, patterns and documents together. Cancellation or a
failed replacement retains the active source. Cancelling music terminates only
the music Worker; restarting uses the checked package without fetching again.
Cancelling a query stops that caller's wait while shared synchronization can
continue. Exports record light-client transport, OutPoint, genesis and hashes.
Module Workers, blob imports and WASM compilation must be permitted.

The native administrative deployment tool below remains an independent RPC CLI;
it is not used by the browser's chain-data path.

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

Minting uses the shared light client for funding, authorization Cells, dependencies
and broadcast. Configure WSS peers in **Settings → CKB light client**; there is no RPC selector.
Wait for wallet history synchronization before preparing. Keys stay in the wallet.

Each record is a Spore V2 with `content_type = "dob/1"`, the collection's Cluster ID and UTF-8 JSON content `{"dna":"<64 lowercase hex characters>"}`. The Cluster supplies the DOB patterns and music v2 decoder release; audio files and WASM are not duplicated in each record. Playback overrides, reverb and legacy v1 settings are not part of mint content. The active decoder's WASM hash must match the Cluster release, and chain sources must also match its archive hash. Load the deployed ZIP if the bundled build differs.

The browser saves the full signed transaction before sending it. **Mint receipts** lists transaction hashes, DNA, Spore IDs and statuses. Use **Check transaction status** to refresh confirmation and Explorer links after broadcast. If P2P submission times out, use **Resubmit signed transaction**: it checks the original hash and only resends the saved bytes. It never generates a replacement batch. Export receipts for backup; clearing browser storage removes local recovery data. Storage failure prevents the initial broadcast. Preparation/generation can be cancelled; reject a pending signature in your wallet.

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
exact signed transaction for recovery. A submission timeout is not proof of rejection.
See the native tool README for command details. No migration is executed by the
website build, tests or setup script.


### Wallet record gallery

Open **Gallery** and connect a testnet wallet. Mint and Gallery share the same wallet
connection. The gallery subscribes to every distinct lock returned by the wallet,
waits for synchronization, and pages through live Cells using the shared light
client. It checks each output's owner lock, Spore V2 type, Cluster ID, DOB/1 content
and 32-byte DNA. Other collections are excluded; malformed Spore data is skipped
with a warning. Local mint receipts and pending outputs are not the asset source.

Cards are paginated in groups of 12. Select a card for its full Spore ID, DNA,
owner, output reference and traits. The selected decoder must match the Cluster's
music release; otherwise load the deployed ZIP in Settings. Covers and music v2
are generated in a separate Worker from Create. Select **Generate music**, then
Play in the audio controls, or **Download WAV**. Rendering can be cancelled.

Loaders show wallet scanning, cover decoding, and music generation. **View logs**
opens global diagnostics. Refresh after a mint confirms or a transfer completes;
the gallery is a snapshot, not a live subscription to wallet ownership changes.
Switching wallet invalidates the previous collection. Leaving Gallery stops its
playback, discards generated audio and cancels its own Worker, while shared
light-client synchronization may continue. Reopening Gallery reloads chain data.
If older records are missing, lower the scan start height in Settings and reconnect.
Only addresses exposed by the connected wallet are included.

`test/gallery.test.ts` covers ownership/Cluster filtering, malformed DNA,
pagination, deduplication and cancellation without signing or broadcasting.
Browser acceptance is still performed manually; see `reports/m3/README.md`.

### Light-client regression checks

Offline unit tests in `test/light-client.test.ts` cover WSS configuration,
synchronization before liveness queries, dependency loading before broadcast,
exact-script queries, cancellation and legacy CCC transaction/witness byte
compatibility. Mint tests cover CoBuild positioning and fee inclusion when extra
funding inputs are needed. Run the existing `npm test` command. No browser or real
wallet transaction is started by these tests.

For manual checks, confirm `crossOriginIsolated`, connect to peers, observe script
scan progress, load the chain ZIP, mint with an unrelated funded wallet, then
check confirmation. The application chain-data path should show WSS P2P and
static assets, with no public RPC/indexer calls.


### Light-client startup errors

The generated TOML includes every field required by the SDK's `RunEnv`, including
`[rpc]` and its loopback `listen_address`. This section is required for parsing;
the browser WASM does not start an HTTP RPC server or use it as a fallback.
Startup/query failures show an actionable explanation and expandable technical
details. Worker event/string rejections are normalized consistently. The connection
panel expands on errors so failures triggered by other tabs of the UI remain visible.

### Light-client scan start

In **Settings → CKB light client**, set an inclusive scan start height before
connecting. Leave it blank or choose **Use release default** to use the lower
creation height from the published deployment metadata:

| Artifact | Creation height | Transaction |
| --- | ---: | --- |
| Seedsong Cluster | 22932334 | `0x23f41fabe26d45ef711ad8a1c2f169635cad16e5963f44df114b02694e1b2602` |
| Decoder ZIP | 22931557 | `0x4d54a43844847bd053b8cedf6bf70deb5cdb5904a43378f6db7c4426887a22ba` |

The default is **22931557**. These are release constants in
`src/app/chain/scan.ts`; startup does not query a service to discover them.
When releasing a new Cluster or decoder, update both its transaction hash and
confirmed creation height there, alongside the corresponding mint/decoder
configuration. Custom decoder transactions do not change the published default:
select an earlier height if needed. Older wallet funding can also precede the
default; use **0** to scan the complete wallet history.

The preference is saved locally on connection and applies to all subscribed
scripts. Stop the client before changing it. Reconnecting with the same setting
preserves progress; moving it earlier rewinds subscriptions to cover the missing
history. Legacy subscriptions without saved coverage metadata are rebased once.
Moving it later skips the remaining older scan, but does not erase stored cells.
The SDK cursor is the last processed block, so a nonzero inclusive start `N` is
translated to cursor `N - 1` to include the creation block itself.

`test/scan.test.ts` covers release defaults, input precision, inclusive cursors,
and persisted scan coverage decisions. Run with the existing unit-test command.

### Global diagnostic logs

The floating **Logs** button is available on every tab, including during minting.
It opens a live panel with timestamps, severity, source, text filtering, optional
auto-scroll, clearing and text export. The newest 1,000 entries are retained in
memory for the page session; each message is limited to 4,000 characters.

The SDK starts at **info** level. `LightClient.setTraceLogCallback` supplies
structured block-download/checkpoint events. Ordinary `wasm_logger` messages go
to the SDK's network/database Worker consoles rather than this callback. The
`seedsong-light-client-logs` Vite plugin prepends a console relay exclusively to
the pinned SDK's inline Workers and attaches a capture listener before the SDK
installs startup/command handlers. Relay messages are consumed before they can
be mistaken for a ready signal or RPC response. Console output remains available
in developer tools. No window.Worker/window.console replacement or dependency-file
patching is used; development and production builds use the same integration.
An SDK upgrade that changes the Worker factory fails the transform explicitly so
the bridge can be reviewed.

Sources distinguish `LC WASM`, `LC trace`, lifecycle, P2P proofs, per-script scan
waits, dependency loading, decoder loading and mint steps. Waiting scripts report
their hash, scan cursor, target and peer count every 15 seconds. Mint preparation
separately reports genesis verification, Cluster discovery, Cell liveness,
permissions, wallet addresses, funding and fees. Signing/broadcasting and failures
are also logged. Application logs exclude private keys, signatures, raw signed
transactions and DNA payloads. Exported logs can contain public script identifiers
and transaction hashes.

`test/logs.test.ts` covers retention, Worker forwarding and SDK message isolation,
as well as explicit failure on an incompatible Worker factory.

#### Formatted logs and live mint steps

Log rendering uses [console-feed](https://www.npmjs.com/package/console-feed)
3.8.0. Worker messages retain bounded snapshots of the original console argument
array, preserving `%c` CSS styles, substitutions and inspectable objects. Plain-text
exports and filters use a separate readable message so console CSS parameters do
not appear as log text. Native Worker console output is unchanged.

While a mint operation runs, **Current step** is shown above the action buttons,
with elapsed seconds, light-client state, peers, verified tip and target. Active
chain requests list the exact script or transaction being awaited. Script waits
show their own cursor, target and remaining blocks; proof waits show their current
fetch state. Concurrent requests are tracked separately and removed on completion
or error. Cancelled operations may leave background chain work running, as before.
A deployment-block progress of 100% does not mean newly subscribed wallet or public
mint authorization scripts have scanned through the current chain tip.


### Script-index repair and mint recovery

The UI temporarily uses PR #308 at `fef3c51e847631f6a25550b09c709f233bf2d035`,
packaged as `0.5.5-pr308.fef3c51`. Historical blocks downloaded for a new subscription cannot recreate spent
Cells for an already scanned wallet. A late transaction proof also preserves a
known transaction index so later input processing can remove the correct Cell.
The PR also rewinds script cursors before the inclusive rollback boundary so
re-downloaded blocks can be indexed again. This PR build does not include the
previous Seedsong-only automatic legacy-index repair. Existing damaged indexes
are not automatically rebuilt; use a fresh browser profile for a clean test if
needed. The UI applies the selected start height, and queries wait for the
resulting scan. A snapshot target is used for each synchronization barrier.

After updating, stop/reload the old page so the fixed Worker is actually loaded,
then reconnect and allow subscriptions to finish scanning.
Check an old mint receipt again: its recipient lock is synchronized before reading
confirmation, and every input is checked against chain indexes independently of
local pending reservations. A transaction with an unavailable input is marked
`rejected` with the exact OutPoint and cannot be requeued. Its unchanged signed
bytes cannot repair a spent input; prepare and sign a new mint after recovery.
Only reservations belonging to the invalid transaction are released, and its
unconfirmed output Cells stay unusable. Synchronization failures are errors,
not evidence of spent inputs. Confirmation is rechecked before declaring an input
failure in case the mint confirmed during the query.

`queued` means local relay queue only; `committed` means verified chain confirmation.
Legacy light-client `submitted` receipts are displayed as `queued`. Unknown proof
status stays `unknown`. A manual requeue is allowed for a local pending transaction
only after its inputs are revalidated; there is no automatic retry/broadcast.
Every mint rechecks inputs before requesting a wallet signature and again before
enqueueing. Relay protocol connections are included in info-level diagnostics.

The PR package, pinned commit, checksums and rebuild instructions are in
`vendor/ckb-light-client`. The previous Seedsong archive and its source patch are
retained there for rollback. No RPC/indexer fallback was added to the application.
