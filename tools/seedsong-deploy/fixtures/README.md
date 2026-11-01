# Cluster V2 encoding fixture

`spore-cluster-v2.json` is generated independently of the Rust encoder using
`@ckb-ccc/core` 1.23.0 Molecule codecs and the official `@ckb-ccc/spore` schemas.
It covers ClusterDataV2, Type-ID derivation, the Cluster type hash, and the
complete CoBuild witness for CreateCluster. Inputs and lock arguments are public
synthetic bytes; no private keys, funding, or RPC are involved.

From the UI repository root, regenerate with:

```bash
node tools/seedsong-deploy/fixtures/generate.mjs
```

Run the Rust tests afterwards to check the independent encoders agree. A change
to the fixture is not a substitute for investigating a protocol mismatch.

Schema references inspected on 2026-11-01:

- [Cluster creation and ID derivation](https://github.com/ckb-devrel/ccc/blob/master/packages/spore/src/cluster/index.ts)
- [Cluster V2 data](https://github.com/ckb-devrel/ccc/blob/master/packages/spore/src/codec/cluster.ts)
- [Spore actions](https://github.com/ckb-devrel/ccc/blob/master/packages/spore/src/codec/cobuild/sporeAction.ts)
- [CoBuild action/message tables](https://github.com/ckb-devrel/ccc/blob/master/packages/spore/src/codec/cobuild/buildingPacket.ts)
- [CoBuild witness layout](https://github.com/ckb-devrel/ccc/blob/master/packages/spore/src/codec/cobuild/witnessLayout.ts)
- [CoBuild info hash](https://github.com/ckb-devrel/ccc/blob/master/packages/spore/src/predefined/types.ts)
- [Testnet contract references](https://github.com/ckb-devrel/ccc/blob/master/packages/spore/src/predefined/testnet.advanced.ts)
