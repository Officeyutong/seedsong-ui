import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ccc } from "@ckb-ccc/core";
import { LightClientCkb } from "../src/app/chain/client";
import { DEFAULT_PEERS, networkConfig, normalizePeers } from "../src/app/chain/config";
import { depGroupPoints, transactionFromBytes } from "../src/app/chain/codec";
import { abortable } from "../src/app/chain/runtime";
type Runtime = NonNullable<ConstructorParameters<typeof LightClientCkb>[0]>;
const lock = ccc.Script.from({
    codeHash: `0x${"11".repeat(32)}`,
    hashType: "type",
    args: `0x${"22".repeat(20)}`,
});
const tx = ccc.Transaction.from({
    outputs: [{ lock, capacity: 6100000000n }],
    outputsData: ["0x"],
});

test("configuration accepts WSS peers, fixes testnet, and excludes HTTP endpoints", () => {
    assert.deepEqual(normalizePeers(`${DEFAULT_PEERS[0]}\n${DEFAULT_PEERS[0]}`), [
        DEFAULT_PEERS[0],
    ]);
    for (const value of ["", "https://testnet.ckb.dev/", "/dns4/a/tcp/80/ws/p2p/abc"])
        assert.throws(() => normalizePeers(value));
    const config = networkConfig(DEFAULT_PEERS);
    assert.match(config, /chain = "testnet"/);
    // All RunEnv fields are required, including rpc in the browser WASM build.
    for (const section of ["store", "network", "rpc"]) {
        assert.ok(config.includes(`[${section}]`), `Missing required ${section} section`);
    }
    assert.match(config, /\[rpc\]\s+listen_address = "127\.0\.0\.1:9000"/);
    assert.doesNotMatch(networkConfig(DEFAULT_PEERS), /https?:\/\//);
});
test("a creation proof alone does not establish liveness; queries await synchronization", async () => {
    const events: string[] = [];
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const syncing = new Promise<void>((resolve) => {
        entered = resolve;
    });
    const runtime = {
        transaction: async () => {
            events.push("proof");
            return { transaction: tx, status: "committed" };
        },
        syncScript: async () => {
            events.push("sync");
            entered();
            await gate;
            return {
                getCells: async () => {
                    events.push("cells");
                    return { cells: [], lastCursor: "0x" };
                },
            };
        },
    } as unknown as Runtime;
    const pending = new LightClientCkb(runtime).getCellLive({ txHash: tx.hash(), index: 0 });
    await syncing;
    assert.deepEqual(events, ["proof", "sync"]);
    release();
    assert.equal(await pending, undefined);
    assert.deepEqual(events, ["proof", "sync", "cells"]);
});
test("P2P broadcast loads dependencies first and rejects a changed hash", async () => {
    const events: string[] = [];
    const runtime = {
        dependencies: async () => {
            events.push("dependencies");
        },
        start: async () => ({
            sendTransaction: async () => {
                events.push("broadcast");
                return tx.hash();
            },
        }),
    } as unknown as Runtime;
    assert.equal(await new LightClientCkb(runtime).sendTransactionNoCache(tx), tx.hash());
    assert.deepEqual(events, ["dependencies", "broadcast"]);
    runtime.start = (async () => ({
        sendTransaction: async () => `0x${"ff".repeat(32)}`,
    })) as unknown as Runtime["start"];
    await assert.rejects(
        new LightClientCkb(runtime).sendTransactionNoCache(tx),
        /different transaction hash/,
    );
});
test("known scripts require no network and unsupported prefix discovery fails explicitly", async () => {
    const client = new LightClientCkb({
        start: async () => {
            throw new Error("Unexpected network access");
        },
    } as unknown as Runtime);
    assert.equal(client.addressPrefix, "ckt");
    assert.equal(client.url, "ckb-light-client://testnet");
    assert.equal(
        (await client.getKnownScript(ccc.KnownScript.AnyoneCanPay)).codeHash,
        "0x3419a1c09eb2567f6552ee7a8ecffd64155cffe0f1796e6e61ec088d740c1356",
    );
    await assert.rejects(
        client.findCellsPagedNoCache({
            script: lock,
            scriptType: "lock",
            scriptSearchMode: "prefix",
        }),
        /exact/,
    );
});
test("dep groups retain OutPoints and reject invalid vector lengths", () => {
    const point = ccc.OutPoint.from({ txHash: tx.hash(), index: 7 });
    const bytes = new Uint8Array(40);
    bytes[0] = 1;
    bytes.set(point.toBytes(), 4);
    assert.equal(depGroupPoints(bytes)[0].eq(point), true);
    assert.throws(() => depGroupPoints(bytes.subarray(0, 39)), /size/);
    assert.throws(() => depGroupPoints(new Uint8Array(3)), /Truncated/);
});
test("legacy CCC transaction bytes and witnesses survive the dependency migration", () => {
    const fixture = JSON.parse(
        readFileSync(new URL("./fixtures/ccc-transaction.json", import.meta.url), "utf8"),
    );
    const restored = transactionFromBytes(fixture.bytes);
    assert.equal(restored.hash(), fixture.hash);
    assert.equal(ccc.hexFrom(restored.toBytes()), fixture.bytes);
    assert.deepEqual(restored.witnesses, fixture.witnesses);
});
test("cancelling a caller does not cancel shared synchronization", async () => {
    let finish!: (value: number) => void;
    const work = new Promise<number>((resolve) => {
        finish = resolve;
    });
    const abort = new AbortController();
    const wait = abortable(work, abort.signal);
    abort.abort();
    await assert.rejects(wait, { name: "AbortError" });
    finish(7);
    assert.equal(await work, 7);
});

test("receipt checks synchronize its recipient before consulting the local pending cache", async () => {
    const events: string[] = [];
    const client = new LightClientCkb({
        syncScript: async (script: ccc.ScriptLike, kind: string) => {
            assert.equal(ccc.Script.from(script).eq(lock), true);
            assert.equal(kind, "lock");
            events.push("sync");
            return {};
        },
        transaction: async () => {
            events.push("status");
            return { transaction: tx, status: "committed" };
        },
    } as unknown as Runtime);
    const result = await client.fetchTransactionStatus(tx.hash(), tx);
    assert.equal(result?.status, "committed");
    assert.deepEqual(events, ["sync", "status"]);
});

test("on-chain input checks ignore local reservations but ordinary funding queries retain them", async () => {
    const point = ccc.OutPoint.from({ txHash: tx.hash(), index: 0 });
    const cell = ccc.Cell.from({
        outPoint: point,
        cellOutput: tx.outputs[0],
        outputData: tx.outputsData[0],
    });
    const client = new LightClientCkb({
        transaction: async () => ({ transaction: tx, status: "committed" }),
        syncScript: async () => ({ getCells: async () => ({ cells: [cell], lastCursor: "0x" }) }),
    } as unknown as Runtime);
    await client.cache.markUnusable(point);
    assert.equal(await client.getCellLiveNoCache(point), undefined);
    assert.equal((await client.getCellLiveOnChain(point))?.outPoint.eq(point), true);
});
