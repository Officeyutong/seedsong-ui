import assert from "node:assert/strict";
import test from "node:test";
import { ccc } from "@ckb-ccc/core";
import { packRawSporeData } from "@ckb-ccc/spore/advanced";
import { decodeGalleryRecord, loadWalletRecords } from "../src/app/gallery/api";
import { CLUSTER_ID, SPORE_CODE_HASH, TESTNET_GENESIS } from "../src/app/mint/api";

const owner = ccc.Address.from({
    prefix: "ckt",
    script: {
        codeHash: `0x${"11".repeat(32)}`,
        hashType: "type",
        args: `0x${"22".repeat(20)}`,
    },
});
const dna = "5fd7b23f4e2b571e8a556be689153374f3cdecf64cf551ded800f165dfcd934f";
function cell(clusterId = CLUSTER_ID, content = JSON.stringify({ dna }), contentType = "dob/1") {
    return ccc.Cell.from({
        outPoint: { txHash: `0x${"33".repeat(32)}`, index: 1 },
        cellOutput: {
            capacity: 26500000000n,
            lock: owner.script,
            type: {
                codeHash: SPORE_CODE_HASH,
                hashType: "data1",
                args: `0x${"44".repeat(32)}`,
            },
        },
        outputData: packRawSporeData({
            clusterId,
            contentType,
            content: new TextEncoder().encode(content),
        }),
    });
}

test("gallery decodes a record's actual Spore content and excludes other owners and Clusters", () => {
    assert.equal(decodeGalleryRecord(cell(), owner)?.dna, dna);
    assert.equal(decodeGalleryRecord(cell(`0x${"55".repeat(32)}`), owner), null);
    const other = ccc.Address.from({ prefix: "ckt", script: { ...owner.script, args: "0xab" } });
    assert.equal(decodeGalleryRecord(cell(), other), null);
    assert.throws(() => decodeGalleryRecord(cell(CLUSTER_ID, '{"dna":"bad"}'), owner));
    assert.throws(() => decodeGalleryRecord(cell(CLUSTER_ID, "{}"), owner));
    assert.throws(() =>
        decodeGalleryRecord(cell(CLUSTER_ID, JSON.stringify({ dna }), "text/plain"), owner),
    );
});

test("gallery reads every synchronized page, deduplicates addresses and records, and skips malformed content", async () => {
    const cursors: (string | undefined)[] = [];
    const result = await loadWalletRecords(
        { getAddressObjs: async () => [owner, owner] },
        {
            signal: new AbortController().signal,
        },
        {
            getHeaderByNumber: async () => ({ hash: TESTNET_GENESIS }),
            findCellsPagedNoCache: async (key, _order, _limit, after) => {
                assert.equal(key.scriptType, "lock");
                assert.equal(key.scriptSearchMode, "exact");
                assert.equal(key.withData, true);
                cursors.push(after);
                if (!after) return { cells: [cell(), cell(CLUSTER_ID, "{")], lastCursor: "0x01" };
                if (after === "0x01")
                    return { cells: [cell(), cell(`0x${"66".repeat(32)}`)], lastCursor: "0x02" };
                return { cells: [], lastCursor: "0x02" };
            },
        },
    );
    assert.deepEqual(cursors, [undefined, "0x01", "0x02"]);
    assert.equal(result.records.length, 1);
    assert.equal(result.addresses.length, 1);
    assert.equal(result.skipped, 1);
    assert.equal(result.scannedCells, 4);
});

test("gallery rejects repeated pagination cursors instead of publishing an incomplete collection", async () => {
    await assert.rejects(
        loadWalletRecords(
            { getAddressObjs: async () => [owner] },
            {
                signal: new AbortController().signal,
            },
            {
                getHeaderByNumber: async () => ({ hash: TESTNET_GENESIS }),
                findCellsPagedNoCache: async () => ({ cells: [cell()], lastCursor: "0x01" }),
            },
        ),
        /repeated gallery cursor/,
    );
});

test("gallery cancellation stops a pending scan without turning it into an empty result", async () => {
    const abort = new AbortController();
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
        started = resolve;
    });
    let pages = 0;
    const loading = loadWalletRecords(
        { getAddressObjs: async () => [owner] },
        { signal: abort.signal },
        {
            getHeaderByNumber: async () => ({ hash: TESTNET_GENESIS }),
            findCellsPagedNoCache: async () => {
                pages++;
                started();
                return new Promise(() => {});
            },
        },
    );
    const rejected = assert.rejects(loading, { name: "AbortError" });
    await entered;
    abort.abort();
    await rejected;
    assert.equal(pages, 1);
});
