import assert from "node:assert/strict";
import test from "node:test";
import { ccc } from "@ckb-ccc/core";
import { sporeA } from "@ckb-ccc/spore/advanced";
import {
    CLUSTER_ID,
    TESTNET_GENESIS,
    generateBatchDna,
    normalizeDnas,
    signAndSubmitMint,
    verifyRecords,
} from "../src/app/mint/api";
import type { MintPlan, MintReceipt, MintRecord } from "../src/app/mint/api";

const lock = ccc.Script.from({
    codeHash: `0x${"11".repeat(32)}`,
    hashType: "type",
    args: `0x${"22".repeat(20)}`,
});
function transaction(count: number) {
    const tx = ccc.Transaction.from({
        inputs: [{ previousOutput: { txHash: `0x${"33".repeat(32)}`, index: 0 } }],
    });
    const records: MintRecord[] = [];
    for (let index = 0; index < count; index++) {
        const dna = index.toString(16).padStart(64, "0");
        const sporeId = ccc.hashTypeId(tx.inputs[0], index);
        tx.addOutput(
            {
                lock,
                type: {
                    codeHash: "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
                    hashType: "data1",
                    args: sporeId,
                },
            },
            sporeA.packRawSporeData({
                contentType: "dob/1",
                content: new TextEncoder().encode(JSON.stringify({ dna })),
                clusterId: CLUSTER_ID,
            }),
        );
        records.push({ dna, sporeId, outputIndex: index });
    }
    return { tx, records };
}

test("batch normalization rejects equivalent DNA and enforces the 50-record bound", () => {
    const dna = "ab".repeat(32);
    assert.deepEqual(normalizeDnas([`0x${dna.toUpperCase()}`]), [dna]);
    assert.throws(() => normalizeDnas([dna, dna.toUpperCase()]), /Duplicate/);
    assert.throws(() => normalizeDnas([]), /1–50/);
    assert.throws(() => normalizeDnas(Array(51).fill(dna)), /1–50/);
});

test("batch generation retries duplicate DNA, rejects a stuck source, and respects cancellation", async () => {
    let call = 0;
    const values = await generateBatchDna(2, {
        randomDna: async () => (++call <= 2 ? "00" : "01").repeat(32),
    });
    assert.equal(call, 3);
    assert.equal(new Set(values).size, 2);
    await assert.rejects(
        generateBatchDna(2, { randomDna: async () => "00".repeat(32) }),
        /duplicate/,
    );
    const abort = new AbortController();
    abort.abort();
    let called = false;
    await assert.rejects(
        generateBatchDna(1, {
            signal: abort.signal,
            randomDna: async () => {
                called = true;
                return "00".repeat(32);
            },
        }),
        { name: "AbortError" },
    );
    assert.equal(called, false);
});

test("50 serialized Spore records retain DNA and IDs; changed outputs are rejected", () => {
    const { tx, records } = transaction(50);
    const restored = ccc.Transaction.fromBytes(tx.toBytes());
    verifyRecords(restored, records);
    assert.equal(restored.outputs.length, 50);
    assert.equal(new Set(records.map((record) => record.sporeId)).size, 50);
    const alteredDna = records.map((record) => ({ ...record }));
    alteredDna[49].dna = "ff".repeat(32);
    assert.throws(() => verifyRecords(restored, alteredDna), /DNA or Cluster/);
    const alteredScript = restored.clone();
    alteredScript.outputs[0].type!.codeHash = `0x${"ff".repeat(32)}`;
    assert.throws(() => verifyRecords(alteredScript, records), /Spore ID/);
});

function submissionFixture() {
    const { tx, records } = transaction(2);
    const events: string[] = [];
    const recipient = "test-wallet-address";
    const client = {
        getHeaderByNumber: async () => ({ hash: TESTNET_GENESIS }),
        sendTransaction: async (signed: ccc.Transaction) => {
            events.push("broadcast");
            return signed.hash();
        },
    } as unknown as ccc.Client;
    const signer = {
        client,
        getAddressObjs: async () => [{ script: lock }],
        getRecommendedAddress: async () => recipient,
        signTransaction: async (raw: ccc.Transaction) => {
            events.push("sign");
            raw.witnesses = ["0x1234"];
            return raw;
        },
    } as unknown as ccc.Signer;
    const plan: MintPlan = {
        tx,
        records,
        txHash: tx.hash(),
        signer,
        client,
        recipient,
        clusterOwner: recipient,
        ownerLock: lock,
        recordCapacity: tx.getOutputsCapacity(),
        fee: 1000n,
        feeRate: 1000n,
        rpcUrl: "https://testnet.example",
    };
    return { plan, events };
}

test("signing persists the exact signed bytes before broadcasting, and stops on storage failure", async () => {
    const { plan, events } = submissionFixture();
    const receipts: MintReceipt[] = [];
    const result = await signAndSubmitMint(plan, {
        persist: (receipt) => {
            events.push(`save-${receipt.status}`);
            receipts.push(receipt);
        },
    });
    assert.deepEqual(events, ["sign", "save-signed", "broadcast", "save-submitted"]);
    assert.equal(result.status, "submitted");
    assert.equal(
        ccc.Transaction.fromBytes(ccc.bytesFrom(receipts[0].signedTransaction)).witnesses[0],
        "0x1234",
    );
    const failed = submissionFixture();
    await assert.rejects(
        signAndSubmitMint(failed.plan, {
            persist: () => {
                throw new Error("Storage full");
            },
        }),
        /Storage full/,
    );
    assert.deepEqual(failed.events, ["sign"]);
});

test("wallet changes to a reviewed raw transaction never reach broadcast", async () => {
    const { plan, events } = submissionFixture();
    plan.signer.signTransaction = async (txLike) => {
        const tx = ccc.Transaction.from(txLike);
        tx.outputs[0].capacity += 1n;
        return tx;
    };
    await assert.rejects(
        signAndSubmitMint(plan, {
            persist: () => {
                events.push("save");
            },
        }),
        /wallet changed/,
    );
    assert.deepEqual(events, []);
});
