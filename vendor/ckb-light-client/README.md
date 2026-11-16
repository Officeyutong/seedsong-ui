# Temporary PR #308 light-client SDK

The UI uses `0.5.5-pr308.fef3c51`, built from the unmodified commit
`fef3c51e847631f6a25550b09c709f233bf2d035` on
[PR #308](https://github.com/nervosnetwork/ckb-light-client/pull/308)
(`Officeyutong/ckb-light-client`, branch `fix/historical-script-replay`).
The commit is pinned so later PR updates cannot silently change the test build.

The checked-in npm archive bundles both WASM Workers, JS, TypeScript declarations,
license, and source provenance. Fresh clones and CI install that archive directly;
no local SDK checkout or extra Rust build is needed for the UI. This is the CKB
light client, independent of the on-chain music decoder.

## Included changes

- Historical replay only modifies scripts whose cursor precedes the block.
- Late transaction proofs preserve a known ordinal for the same block.
- Rollback resets affected script cursors before the first removed block.

This unmodified PR build does **not** include the Seedsong-only automatic legacy
index migration. It prevents the covered corruption paths but does not repair
previously damaged browser indexes. For an isolated clean test, use a new browser
profile. Stop/reload old tabs and restart the dev server after switching packages
so old Workers and Vite's dependency cache do not mask the change.

## Rebuild

Install Rust, its wasm32 target, wasm-pack and native build requirements. In a
dedicated SDK checkout:

```sh
git clone --branch fix/historical-script-replay https://github.com/Officeyutong/ckb-light-client.git
```

```sh
cd ckb-light-client
git checkout fef3c51e847631f6a25550b09c709f233bf2d035
npm install
```

Then in seedsong-ui:

```sh
node scripts/pack-light-client.mjs /path/to/ckb-light-client
npm install
npm run build
```

`release.json` records the exact commit and artifact checksums. The packer checks
the commit and clean tracked source, builds the Workers and JS, and writes the
archive and fresh checksums. `--pack-only` is only for a checkout whose complete
JS/WASM build already matches that source. No extra source patch is applied for
this PR version.

## Previous build / rollback

The archive `nervosnetwork-ckb-light-client-js-0.5.5-seedsong.1.tgz`,
`release-seedsong.1.json`, and `index-replay.patch` preserve the previous build,
which additionally included automatic legacy-index repair.
To restore it, copy `release-seedsong.1.json` to `release.json`, set the SDK dependency
in `package.json` back to `file:vendor/ckb-light-client/nervosnetwork-ckb-light-client-js-0.5.5-seedsong.1.tgz`,
run `npm install`, and restart Vite with `npm run dev -- --force`.
To rebuild that older version, use its recorded source commit and apply
`index-replay.patch` before invoking the packer.

Browser testing is performed manually; no transaction is broadcast by packaging.
