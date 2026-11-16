import { ccc } from "@ckb-ccc/core";
import type { LightClient } from "@nervosnetwork/ckb-light-client-js";
import { networkConfig, readPeers, TESTNET_GENESIS } from "./config";
import { depGroupPoints } from "./codec";
import { errorMessage } from "../common/errors";
import { logInfo, logWarn, logError } from "../diagnostics/logs";
import {
    needsScanReset,
    parseStartHeight,
    readStartHeightInput,
    scanCursor,
    SCAN_ORIGINS_KEY,
    START_HEIGHT_KEY,
} from "./scan";
import { createWaitTracker } from "./waits";
import type { ChainWait, WaitHandle } from "./waits";
export interface ChainState {
    phase: "idle" | "starting" | "running" | "error";
    peers: number;
    tip: bigint;
    target: bigint;
    synced: bigint;
    scripts: number;
    startHeight: bigint;
    message: string;
    error: string;
    waits: readonly ChainWait[];
}
export async function pause(signal?: AbortSignal, ms = 1000): Promise<void> {
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
        const cancel = () => {
            clearTimeout(timer);
            reject(signal!.reason);
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", cancel);
            resolve();
        }, ms);
        signal?.addEventListener("abort", cancel, { once: true });
    });
}
export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        const abort = () => reject(signal.reason);
        const clean = () => signal.removeEventListener("abort", abort);
        work.then(
            (value) => {
                clean();
                resolve(value);
            },
            (error) => {
                clean();
                reject(error);
            },
        );
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, { once: true });
    });
}
export async function deadline<T>(promise: Promise<T>, ms = 30_000): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () =>
                        reject(
                            new Error(
                                "Light client did not respond. Stop it and reconnect; check browser storage permissions if startup failed.",
                            ),
                        ),
                    ms,
                );
            }),
        ]);
    } finally {
        clearTimeout(timer!);
    }
}
const initial: ChainState = {
    phase: "idle",
    peers: 0,
    tip: 0n,
    target: 0n,
    synced: 0n,
    scripts: 0,
    startHeight: parseStartHeight(readStartHeightInput()),
    message: "Connect to CKB testnet peers to read chain data.",
    error: "",
    waits: [],
};
/** A single main-thread owner coordinates the network/database Workers. */
class ChainRuntime {
    private node: LightClient | null = null;
    private boot: Promise<LightClient> | null = null;
    private generation = 0;
    private timer: ReturnType<typeof setInterval> | undefined;
    private refreshing: Promise<void> | null = null;
    private release: (() => void) | undefined;
    private updates = new Set<() => void>();
    private scripts = Promise.resolve();
    private state: ChainState = { ...initial };
    private lastStatusLog = 0;
    private waits = createWaitTracker((waits) => this.update({ waits }));
    getSnapshot = () => this.state;
    subscribe = (callback: () => void) => {
        this.updates.add(callback);
        return () => {
            this.updates.delete(callback);
        };
    };
    private update(value: Partial<ChainState>) {
        if (value.error && value.error !== this.state.error) logError("LC", value.error);
        this.state = { ...this.state, ...value };
        this.updates.forEach((callback) => callback());
    }
    setStartHeight(value: string) {
        if (this.node || this.boot)
            throw new Error("Stop the light client before changing its start height.");
        const height = parseStartHeight(value);
        if (value.trim()) localStorage.setItem(START_HEIGHT_KEY, height.toString());
        else localStorage.removeItem(START_HEIGHT_KEY);
        this.update({ startHeight: height });
        logInfo("LC", `Scan start set to ${height} (inclusive).`);
    }
    private async configureScripts(
        node: LightClient,
        requested?: { script: ccc.Script; scriptType: "lock" | "type" },
    ) {
        let origins: Record<string, string> = {};
        try {
            const saved: unknown = JSON.parse(localStorage.getItem(SCAN_ORIGINS_KEY) ?? "{}");
            if (saved && typeof saved === "object" && !Array.isArray(saved))
                origins = saved as Record<string, string>;
        } catch {
            /* Missing metadata causes a conservative rescan. */
        }
        const height = this.state.startHeight;
        const existing = await deadline(node.getScripts());
        const entries = requested
            ? [
                  {
                      ...requested,
                      blockNumber: existing.find(
                          (item) =>
                              item.scriptType === requested.scriptType &&
                              ccc.Script.from(item.script).eq(requested.script),
                      )?.blockNumber,
                  },
              ]
            : existing;
        const updates = [];
        for (const entry of entries) {
            const key = `${entry.scriptType}:${ccc.Script.from(entry.script).hash()}`;
            if (
                entry.blockNumber === undefined ||
                needsScanReset(entry.blockNumber, origins[key], height)
            )
                updates.push({ ...entry, blockNumber: scanCursor(height) });
            origins[key] = height.toString();
        }
        if (this.node !== node) throw new DOMException("Light client stopped", "AbortError");
        if (updates.length) {
            logInfo(
                "LC scripts",
                `Updating ${updates.length} subscription(s), first block ${height}, cursor ${scanCursor(height)}.`,
            );
            await deadline(node.setScripts(updates, 1));
            logInfo("LC scripts", "Subscriptions saved; scanning continues in the background.");
        }
        if (this.node !== node) throw new DOMException("Light client stopped", "AbortError");
        localStorage.setItem(SCAN_ORIGINS_KEY, JSON.stringify(origins));
    }
    async start(peers = readPeers()): Promise<LightClient> {
        if (this.boot) return this.boot;
        if (this.node) return this.node;
        const generation = this.generation;
        const current = () => {
            if (generation !== this.generation)
                throw new DOMException("Light client stopped", "AbortError");
        };
        logInfo("LC", `Starting testnet light client with ${peers.length} WSS peer(s).`);
        const boot = (async () => {
            if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === "undefined")
                throw new Error(
                    "The light client needs cross-origin isolation. Serve COOP: same-origin and COEP: credentialless (or require-corp), then reload.",
                );
            if (!("waitAsync" in Atomics) || !navigator.locks)
                throw new Error(
                    "Use a current browser with Atomics.waitAsync and Web Locks on HTTPS or localhost.",
                );
            this.update({ phase: "starting", message: "Loading the light client…", error: "" });
            logInfo("LC", "Loading the light-client SDK…");
            const { LightClient, randomSecretKey } =
                await import("@nervosnetwork/ckb-light-client-js");
            current();
            logInfo("LC", "Acquiring the browser database lock…");
            this.update({ message: "Acquiring the browser database lock…" });
            await new Promise<void>((resolve, reject) => {
                void navigator.locks
                    .request("seedsong.ckb-light-client", { ifAvailable: true }, async (lock) => {
                        if (generation !== this.generation) {
                            reject(new DOMException("Light client stopped", "AbortError"));
                            return;
                        }
                        if (!lock) {
                            reject(
                                new Error(
                                    "A Seedsong light client is already running in another tab. Stop it or close that tab first.",
                                ),
                            );
                            return;
                        }
                        await new Promise<void>((release) => {
                            this.release = release;
                            resolve();
                        });
                    })
                    .catch(reject);
            });
            current();
            let key = localStorage.getItem("seedsong.light.identity");
            if (!/^0x[0-9a-f]{64}$/.test(key ?? "")) {
                key = randomSecretKey();
                localStorage.setItem("seedsong.light.identity", key);
            }
            const node = new LightClient();
            this.node = node;
            node.setTraceLogCallback((record) => {
                if (this.node !== node) return;
                if (record.type === "DownloadBlock")
                    logInfo(
                        "LC trace",
                        `Downloaded blocks from ${record.start_at}: ${record.count} blocks, ${record.matched_count} matched.`,
                    );
                else if (record.type === "FinalizeCheckPoints")
                    logInfo(
                        "LC trace",
                        `Finalized ${record.count} checkpoints through block ${record.stop_at}.`,
                    );
            });
            logInfo("LC", "Starting database/network Workers (info logging, WSS)…");
            this.update({ message: "Starting database/network Workers (info logging, WSS)…" });
            await deadline(
                node.start(
                    { type: "TestNet", config: networkConfig(peers) },
                    key as ccc.Hex,
                    "info",
                    "wss",
                ),
                45_000,
            );
            current();
            logInfo("LC", "Workers started. Verifying testnet genesis…");
            this.update({ message: "Workers started. Verifying testnet genesis…" });
            if ((await deadline(node.getGenesisBlock())).header.hash !== TESTNET_GENESIS)
                throw new Error("Light client genesis is not CKB testnet.");
            this.update({ startHeight: parseStartHeight(readStartHeightInput()) });
            logInfo("LC", "Testnet genesis verified. Restoring subscriptions…");
            this.update({ message: "Testnet genesis verified. Restoring subscriptions…" });
            await this.configureScripts(node);
            current();
            this.update({
                phase: "running",
                message: "Connecting to testnet peers and verifying chain data…",
            });
            await this.refresh();
            logInfo("LC", "Light client started; waiting for peers and scan progress.");
            this.timer = setInterval(() => {
                void this.refresh().catch((error) => this.update({ error: errorMessage(error) }));
            }, 5000);
            return node;
        })()
            .catch(async (error) => {
                if (generation === this.generation) {
                    const node = this.node;
                    this.node = null;
                    await node?.stop().catch(() => {});
                    this.release?.();
                    this.release = undefined;
                    this.update({
                        phase: "error",
                        error: errorMessage(error),
                        message: "Light client could not start.",
                    });
                }
                throw error;
            })
            .finally(() => {
                if (this.boot === boot) this.boot = null;
            });
        this.boot = boot;
        return boot;
    }
    async stop() {
        logInfo("LC", "Stopping the light client…");
        this.generation++;
        this.waits.clear();
        clearInterval(this.timer);
        this.timer = undefined;
        const node = this.node;
        this.node = null;
        this.boot = null;
        this.scripts = Promise.resolve();
        this.refreshing = null;
        try {
            await node?.stop();
        } finally {
            this.release?.();
            this.release = undefined;
            this.update({ ...initial, startHeight: parseStartHeight(readStartHeightInput()) });
            logInfo("LC", "Light client stopped.");
        }
    }
    refresh(): Promise<void> {
        if (this.refreshing) return this.refreshing;
        if (!this.node || this.state.phase !== "running") return Promise.resolve();
        const node = this.node;
        const work = (async () => {
            const [peers, tip, scripts] = await deadline(
                Promise.all([node.getPeers(), node.getTipHeader(), node.getScripts()]),
            );
            if (this.node !== node) return;
            const target = peers.reduce((max, peer) => {
                const n = peer.syncState?.provedBestKnownHeader?.number ?? 0n;
                return n > max ? n : max;
            }, tip.number);
            const synced = scripts.reduce(
                (min, script) => (script.blockNumber < min ? script.blockNumber : min),
                tip.number,
            );
            if (
                peers.length !== this.state.peers ||
                scripts.length !== this.state.scripts ||
                Date.now() - this.lastStatusLog >= 15000
            ) {
                this.lastStatusLog = Date.now();
                logInfo(
                    "LC relay",
                    `Active RelayV3 connections: ${peers.filter((peer) => peer.protocols.some((protocol) => ccc.numFrom(protocol.id) === 101n)).length}. Protocols: ${peers.map((peer) => `${peer.nodeId}: ${peer.protocols.map((protocol) => `${protocol.id}/${protocol.version}`).join(",")}`).join("; ")}`,
                );
                logInfo(
                    "LC sync",
                    `Peers ${peers.length}; verified tip ${tip.number}; target ${target}; minimum scan ${synced}; ${scripts.length} script(s).`,
                );
            }
            this.update({
                peers: peers.length,
                tip: tip.number,
                target,
                synced,
                scripts: scripts.length,
                error: "",
                message: !peers.length
                    ? "Waiting for WSS peers…"
                    : scripts.length && synced < target
                      ? "Synchronizing subscribed scripts…"
                      : "Connected to CKB testnet peers.",
            });
        })().finally(() => {
            if (this.refreshing === work) this.refreshing = null;
        });
        this.refreshing = work;
        return work;
    }
    async syncScript(
        scriptLike: ccc.ScriptLike,
        scriptType: "lock" | "type",
        signal?: AbortSignal,
    ): Promise<LightClient> {
        const script = ccc.Script.from(scriptLike);
        const wait = this.waits.begin("script", `${scriptType} script ${script.hash()}`);
        try {
            return await this.syncScriptWithWait(script, scriptType, wait, signal);
        } finally {
            wait.finish();
        }
    }
    private async syncScriptWithWait(
        scriptLike: ccc.ScriptLike,
        scriptType: "lock" | "type",
        wait: WaitHandle,
        signal?: AbortSignal,
    ): Promise<LightClient> {
        const node = await this.start();
        const script = ccc.Script.from(scriptLike);
        const label = `${scriptType} script ${script.hash()}`;
        logInfo(
            "LC scripts",
            `Waiting for ${label} to synchronize (code ${script.codeHash}, args ${script.args}).`,
        );
        wait.update({ detail: "Registering the script subscription…" });
        // Serialize subscription changes; retain progress when coverage is sufficient.
        const add = this.scripts
            .catch(() => {})
            .then(() => this.configureScripts(node, { script, scriptType }));
        this.scripts = add;
        await add;
        const expires = Date.now() + 180_000;
        let lastReport = 0;
        let requiredTarget: bigint | undefined;
        do {
            signal?.throwIfAborted();
            if (this.node !== node)
                throw new Error("Light client was stopped. Reconnect before querying chain data.");
            await this.refresh();
            if (this.state.peers > 0 && this.state.target > 0n)
                requiredTarget ??= this.state.target;
            const scripts = await deadline(node.getScripts());
            const status = scripts.find(
                (status) =>
                    status.scriptType === scriptType && ccc.Script.from(status.script).eq(script),
            );
            wait.update({
                detail:
                    this.state.peers === 0
                        ? "Waiting for WSS peers…"
                        : this.state.target === 0n
                          ? "Waiting for a verified target header…"
                          : "Scanning subscribed script history…",
                cursor: status?.blockNumber,
                target: requiredTarget ?? this.state.target,
            });
            if (Date.now() - lastReport >= 15000) {
                lastReport = Date.now();
                logInfo(
                    "LC scripts",
                    `${label}: cursor ${status?.blockNumber ?? "not subscribed"}; target ${requiredTarget ?? this.state.target}; ${this.state.peers} peer(s).`,
                );
            }
            if (
                this.state.peers > 0 &&
                requiredTarget !== undefined &&
                status &&
                status.blockNumber >= requiredTarget
            ) {
                logInfo("LC scripts", `${label} synchronized through ${status.blockNumber}.`);
                return node;
            }
            await pause(signal);
        } while (Date.now() < expires);
        logWarn(
            "LC scripts",
            `${label} is still scanning after 180 seconds; retry when it catches up.`,
        );
        throw new Error(
            "Script synchronization is still in progress. Keep the light client connected and retry when its scan has caught up.",
        );
    }
    async transaction(
        hashLike: ccc.HexLike,
        signal?: AbortSignal,
        timeout = 180_000,
    ): Promise<ccc.ClientTransactionResponse | undefined> {
        const wait = this.waits.begin("transaction", ccc.hexFrom(hashLike));
        try {
            return await this.transactionWithWait(hashLike, wait, signal, timeout);
        } finally {
            wait.finish();
        }
    }
    private async transactionWithWait(
        hashLike: ccc.HexLike,
        wait: WaitHandle,
        signal?: AbortSignal,
        timeout = 180_000,
    ): Promise<ccc.ClientTransactionResponse | undefined> {
        const node = await this.start();
        const hash = ccc.hexFrom(hashLike);
        logInfo("LC proof", `Fetching transaction ${hash} (timeout ${timeout / 1000}s)…`);
        const genesis = await deadline(node.getGenesisBlock());
        const genesisTx = genesis.transactions.find((tx) => tx.hash() === hash);
        if (genesisTx)
            return { transaction: genesisTx, status: "committed", blockHash: genesis.header.hash };
        const expires = Date.now() + timeout;
        let lastReport = 0;
        do {
            signal?.throwIfAborted();
            if (this.node !== node)
                throw new Error("Light client stopped while fetching a transaction.");
            wait.update({ detail: "Requesting the transaction and Merkle proof from peers…" });
            const response = await deadline(node.fetchTransaction(hash));
            wait.update({ detail: `Transaction proof: ${response.status}. Waiting for P2P data…` });
            if (response.status === "fetched") {
                const value = response.data;
                if (value?.transaction && value.transaction.hash() !== hash)
                    throw new Error("Fetched transaction hash mismatch.");
                logInfo(
                    "LC proof",
                    `Transaction ${hash}: ${value?.status ?? "no transaction data"}.`,
                );
                return value;
            }
            if (Date.now() - lastReport >= 15000) {
                lastReport = Date.now();
                logInfo(
                    "LC proof",
                    `Transaction ${hash}: ${response.status}; ${this.state.peers} peer(s), verified tip ${this.state.tip}.`,
                );
            }
            if (timeout === 0) return undefined;
            await pause(signal);
        } while (Date.now() < expires);
        logWarn("LC proof", `Timed out waiting for transaction ${hash}.`);
        throw new Error(
            "Transaction proof is not available yet. Wait for peers and synchronization, then retry.",
        );
    }
    async dependencies(tx: ccc.Transaction) {
        const hashes = new Set([
            ...tx.inputs.map((input) => input.previousOutput.txHash),
            ...tx.cellDeps.map((dep) => dep.outPoint.txHash),
        ]);
        logInfo(
            "LC dependencies",
            `Fetching ${hashes.size} input/dependency transaction(s) for ${tx.hash()}.`,
        );
        const transactions = await Promise.all([...hashes].map((hash) => this.transaction(hash)));
        for (const dep of tx.cellDeps.filter((dep) => dep.depType === "depGroup")) {
            const source = transactions.find(
                (item) => item?.transaction.hash() === dep.outPoint.txHash,
            )?.transaction;
            const data = source?.outputsData[Number(dep.outPoint.index)];
            if (!data) throw new Error("Dependency group data is unavailable.");
            await Promise.all(depGroupPoints(data).map((point) => this.transaction(point.txHash)));
        }
    }
}
export const chainRuntime = new ChainRuntime();
