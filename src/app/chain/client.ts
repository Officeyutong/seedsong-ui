import { ccc } from "@ckb-ccc/core";
import { TESTNET_SCRIPTS, type ClientCollectableSearchKeyLike } from "@ckb-ccc/core/advancedBarrel";
import { logInfo } from "../diagnostics/logs";
import { LIGHT_CLIENT_URL } from "./config";
import { pause, deadline, chainRuntime } from "./runtime";
type Runtime = Pick<typeof chainRuntime, "start" | "syncScript" | "transaction" | "dependencies">;
/** Wallet/transaction interfaces backed exclusively by the local P2P node. */
export class LightClientCkb extends ccc.Client {
    private runtime: Runtime;
    constructor(runtime: Runtime = chainRuntime) {
        super();
        this.runtime = runtime;
        if (runtime === chainRuntime)
            chainRuntime.subscribe(() => {
                if (chainRuntime.getSnapshot().phase === "idle")
                    this.cache = new ccc.ClientCacheMemory();
            });
    }
    get url() {
        return LIGHT_CLIENT_URL;
    }
    get addressPrefix() {
        return "ckt";
    }
    async getKnownScript(script: ccc.KnownScript) {
        const value = TESTNET_SCRIPTS[script];
        if (!value) throw new Error(`No testnet deployment registered for ${script}.`);
        return ccc.ScriptInfo.from(value);
    }
    async getFeeRateStatistics() {
        return { mean: 1000n, median: 1000n };
    }
    async getTip() {
        return (await this.getTipHeader()).number;
    }
    async getTipHeader() {
        return deadline((await this.runtime.start()).getTipHeader());
    }
    async getBlockByNumber(number: ccc.NumLike): Promise<ccc.ClientBlock | undefined> {
        if (ccc.numFrom(number) === 0n)
            return deadline((await this.runtime.start()).getGenesisBlock());
        throw new Error(
            "Use verified headers and transactions; complete arbitrary blocks are unavailable through the light-client interface.",
        );
    }
    async getBlockByHash(hash: ccc.HexLike) {
        const genesis = await deadline((await this.runtime.start()).getGenesisBlock());
        if (genesis.header.hash === ccc.hexFrom(hash)) return genesis;
        throw new Error(
            "Complete non-genesis blocks are unavailable through the light-client interface.",
        );
    }
    async getHeaderByNumber(number: ccc.NumLike) {
        if (ccc.numFrom(number) === 0n)
            return (await deadline((await this.runtime.start()).getGenesisBlock())).header;
        const tip = await this.getTipHeader();
        if (tip.number === ccc.numFrom(number)) return tip;
        throw new Error("Look up non-tip headers by hash through the light client.");
    }
    async getHeaderByHash(hash: ccc.HexLike) {
        const node = await this.runtime.start();
        const known = await deadline(node.getHeader(hash));
        if (known) return known;
        for (let attempt = 0; attempt < 120; attempt++) {
            const response = await deadline(node.fetchHeader(hash));
            if (response.status === "fetched") {
                if (response.data.hash !== ccc.hexFrom(hash))
                    throw new Error("Fetched header hash mismatch.");
                return response.data;
            }
            await pause();
        }
        throw new Error("Header proof is still unavailable. Wait for peers, then retry.");
    }
    async estimateCycles(value: ccc.TransactionLike) {
        const tx = ccc.Transaction.from(value);
        logInfo("LC transaction", `Loading dependencies before cycle estimation for ${tx.hash()}…`);
        await this.runtime.dependencies(tx);
        logInfo("LC transaction", "Estimating transaction cycles…");
        const cycles = await deadline((await this.runtime.start()).estimateCycles(tx), 60_000);
        logInfo("LC transaction", `Cycle estimation complete: ${cycles}.`);
        return cycles;
    }
    async sendTransactionDry(value: ccc.TransactionLike) {
        return this.estimateCycles(value);
    }
    async sendTransactionNoCache(value: ccc.TransactionLike) {
        const tx = ccc.Transaction.from(value);
        await this.runtime.dependencies(tx);
        logInfo("LC transaction", `Adding ${tx.hash()} to the local P2P relay queue…`);
        const hash = await deadline((await this.runtime.start()).sendTransaction(tx), 60_000);
        if (hash !== tx.hash())
            throw new Error("Light client returned a different transaction hash.");
        logInfo(
            "LC transaction",
            `Local relay queue accepted ${hash}; remote acceptance is not confirmed.`,
        );
        return hash;
    }
    async fetchTransactionStatus(hash: ccc.HexLike, hint?: ccc.TransactionLike) {
        // fetchTransaction can return local pending data without requesting a proof.
        // A synchronized recipient lock indexes the mint itself if it was confirmed.
        const known = hint ? ccc.Transaction.from(hint) : undefined;
        if (known && known.hash() !== ccc.hexFrom(hash))
            throw new Error("Transaction hint hash mismatch.");
        if (known) {
            const lock =
                known.outputs.find((output) => output.type)?.lock ?? known.outputs[0]?.lock;
            if (lock) await this.runtime.syncScript(lock, "lock");
        }
        return this.runtime.transaction(hash, undefined, 0);
    }
    async getTransactionNoCache(hash: ccc.HexLike) {
        return this.runtime.transaction(hash);
    }
    async getCellLiveNoCache(pointLike: ccc.OutPointLike): Promise<ccc.Cell | undefined> {
        const point = ccc.OutPoint.from(pointLike);
        if (await this.cache.isUnusable(point)) return undefined;
        return this.getCellLiveOnChain(point);
    }
    /** Check verified script indexes, ignoring our own local pending reservations. */
    async getCellLiveOnChain(pointLike: ccc.OutPointLike): Promise<ccc.Cell | undefined> {
        const point = ccc.OutPoint.from(pointLike);
        const response = await this.getTransactionNoCache(point.txHash);
        const output = response?.transaction.outputs[Number(point.index)];
        if (!output) return undefined;
        // A verified creation transaction alone does not prove an unspent output.
        const script = output.type ?? output.lock;
        const scriptType = output.type ? "type" : "lock";
        const node = await this.runtime.syncScript(script, scriptType);
        let after: ccc.Hex | undefined;
        do {
            const page = await deadline(
                node.getCells(
                    { script, scriptType, scriptSearchMode: "exact", withData: true },
                    "asc",
                    100,
                    after,
                ),
            );
            const found = page.cells.find((cell) => ccc.OutPoint.from(cell.outPoint).eq(point));
            if (found) return ccc.Cell.from(found);
            if (!page.cells.length || page.lastCursor === after) return undefined;
            after = page.lastCursor as ccc.Hex;
        } while (after);
        return undefined;
    }
    async *findCells(
        key: ClientCollectableSearchKeyLike,
        order?: "asc" | "desc",
        limit = 10,
    ): AsyncGenerator<ccc.Cell> {
        // Never yield stale cached funding Cells ahead of synchronization.
        for await (const cell of this.findCellsOnChain(key, order, limit)) {
            if (!(await this.cache.isUnusable(cell.outPoint))) yield cell;
        }
    }
    async findCellsPagedNoCache(
        key: ccc.ClientIndexerSearchKeyLike,
        order?: "asc" | "desc",
        limit?: ccc.NumLike,
        after?: string,
    ): Promise<ccc.ClientFindCellsResponse> {
        if (key.scriptSearchMode && key.scriptSearchMode !== "exact")
            throw new Error("Light-client subscriptions require an exact lock or type script.");
        const node = await this.runtime.syncScript(key.script, key.scriptType);
        const result = await deadline(
            node.getCells(
                { ...key, scriptSearchMode: "exact" },
                order,
                limit,
                after as ccc.Hex | undefined,
            ),
        );
        return {
            lastCursor: result.lastCursor,
            cells: result.cells.map((cell) => ccc.Cell.from(cell)),
        };
    }
    async findTransactionsPaged(
        key: ccc.ClientIndexerSearchKeyTransactionLike & { groupByTransaction: true },
        order?: "asc" | "desc",
        limit?: ccc.NumLike,
        after?: string,
    ): Promise<ccc.ClientFindTransactionsGroupedResponse>;
    async findTransactionsPaged(
        key: ccc.ClientIndexerSearchKeyTransactionLike & { groupByTransaction?: false | null },
        order?: "asc" | "desc",
        limit?: ccc.NumLike,
        after?: string,
    ): Promise<ccc.ClientFindTransactionsResponse>;
    async findTransactionsPaged(
        key: ccc.ClientIndexerSearchKeyTransactionLike,
        order?: "asc" | "desc",
        limit?: ccc.NumLike,
        after?: string,
    ): Promise<ccc.ClientFindTransactionsResponse | ccc.ClientFindTransactionsGroupedResponse>;
    async findTransactionsPaged(
        key: ccc.ClientIndexerSearchKeyTransactionLike,
        order?: "asc" | "desc",
        limit?: ccc.NumLike,
        after?: string,
    ): Promise<ccc.ClientFindTransactionsResponse | ccc.ClientFindTransactionsGroupedResponse> {
        if (key.scriptSearchMode && key.scriptSearchMode !== "exact")
            throw new Error("Light-client subscriptions require an exact lock or type script.");
        const node = await this.runtime.syncScript(key.script, key.scriptType);
        const page = await deadline(
            node.getTransactions(
                { ...key, scriptSearchMode: "exact" },
                order,
                limit,
                after as ccc.Hex | undefined,
            ),
        );
        if (key.groupByTransaction)
            return {
                lastCursor: page.lastCursor,
                transactions: page.transactions.map((item) => ({
                    txHash: item.transaction.hash(),
                    blockNumber: item.blockNumber,
                    txIndex: item.txIndex,
                    cells:
                        "cells" in item
                            ? item.cells.map(([type, index]) => ({
                                  isInput: type === "input",
                                  cellIndex: BigInt(index),
                              }))
                            : [{ isInput: item.ioType === "input", cellIndex: item.ioIndex }],
                })),
            };
        return {
            lastCursor: page.lastCursor,
            transactions: page.transactions.flatMap((item) =>
                "cells" in item
                    ? item.cells.map(([type, index]) => ({
                          txHash: item.transaction.hash(),
                          blockNumber: item.blockNumber,
                          txIndex: item.txIndex,
                          isInput: type === "input",
                          cellIndex: BigInt(index),
                      }))
                    : [
                          {
                              txHash: item.transaction.hash(),
                              blockNumber: item.blockNumber,
                              txIndex: item.txIndex,
                              isInput: item.ioType === "input",
                              cellIndex: item.ioIndex,
                          },
                      ],
            ),
        };
    }
    async getCellsCapacity(key: ccc.ClientIndexerSearchKeyLike) {
        if (key.scriptSearchMode && key.scriptSearchMode !== "exact")
            throw new Error("Light-client subscriptions require an exact lock or type script.");
        const node = await this.runtime.syncScript(key.script, key.scriptType);
        return deadline(node.getCellsCapacity({ ...key, scriptSearchMode: "exact" }));
    }
}
let singleton: LightClientCkb | undefined;
export function getChainClient(): LightClientCkb {
    return (singleton ??= new LightClientCkb());
}
