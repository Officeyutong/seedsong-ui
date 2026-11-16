export const TESTNET_GENESIS = "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606";
export const LIGHT_CLIENT_URL = "ckb-light-client://testnet";
export const DEFAULT_PEERS = [
    "/dns4/dagon.ckb.guide/tcp/443/wss/p2p/QmX5D6aJiAQ5Fxn4BfVqSn6zrgyuQM1oXVC9yvmzLuHXnx",
    "/dns4/javelin.ckb.guide/tcp/443/wss/p2p/QmPcJY2gZLUm66szYA9QaG1P3rzwseWCMgbj6AyNCyW4G2",
    "/dns4/diadem.ckb.guide/tcp/443/wss/p2p/QmQMjFrNGaphzfHin3mbYybbJcFMDUihKAcknquYvm9J3W",
    "/dns4/bloodstone.ckb.guide/tcp/443/wss/p2p/QmQoTR39rBkpZVgLApDGDoFnJ2YDBS9hYeiib1Z6aoAdEf",
    "/dns4/crown.ckb.guide/tcp/443/wss/p2p/QmTt6HeNakL8Fpmevrhdna7J4NzEMf9pLchf1CXtmtSrwb",
    "/dns4/mekansm.ckb.guide/tcp/443/wss/p2p/QmT6DFfm18wtbJz3y4aPNn3ac86N4d4p4xtfQRRPf73frC",
];
export function normalizePeers(value: string): string[] {
    const peers = [
        ...new Set(
            value
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean),
        ),
    ];
    if (
        !peers.length ||
        peers.length > 32 ||
        peers.some(
            (peer) =>
                !/^\/(dns4|dns6|ip4|ip6)\/[^\s/]+\/tcp\/\d+\/wss\/p2p\/[A-Za-z0-9]+$/.test(peer),
        )
    )
        throw new Error("Enter 1–32 WSS peer multiaddresses, one per line.");
    return peers;
}
export function networkConfig(peers: string[]): string {
    normalizePeers(peers.join("\n"));
    return `chain = "testnet"
[store]
path = "data/store"
[network]
path = "data/network"
listen_addresses = []
bootnodes = ${JSON.stringify(peers)}
max_peers = 16
max_outbound_peers = 4
ping_interval_secs = 120
ping_timeout_secs = 1200
connect_outbound_interval_secs = 5
upnp = false
discovery_local_address = false
bootnode_mode = false
# Required by RunEnv even though the browser WASM does not run an RPC server.
[rpc]
listen_address = "127.0.0.1:9000"
`;
}
export function readPeers(): string[] {
    try {
        return normalizePeers(
            JSON.parse(localStorage.getItem("seedsong.light.peers") ?? "null")?.join("\n") ??
                DEFAULT_PEERS.join("\n"),
        );
    } catch {
        return [...DEFAULT_PEERS];
    }
}
