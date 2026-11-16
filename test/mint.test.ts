import assert from "node:assert/strict";
import test from "node:test";
import { ccc } from "@ckb-ccc/core";
import * as sporeA from "@ckb-ccc/spore/advanced";
import {
    CLUSTER_ID,
    checkMint,
    TESTNET_GENESIS,
    generateBatchDna,
    normalizeDnas,
    signAndSubmitMint,
    verifyRecords,
    resubmitMint,
} from "../src/app/mint/api";
import type { LightClientCkb } from "../src/app/chain/client";
import { transactionFromBytes } from "../src/app/chain/codec";
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
    const restored = transactionFromBytes(tx.toBytes());
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
        cache: new ccc.ClientCacheMemory(),
        getCellLiveOnChain: async (point: ccc.OutPointLike) =>
            ccc.Cell.from({
                outPoint: point,
                cellOutput: { lock, capacity: 100000000000n },
                outputData: "0x",
            }),
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
        transport: "light-client",
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
    assert.deepEqual(events, ["sign", "save-signed", "broadcast", "save-queued"]);
    assert.equal(result.status, "queued");
    assert.equal(
        transactionFromBytes(ccc.bytesFrom(receipts[0].signedTransaction)).witnesses[0],
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

// Public minting must work with a non-owner signer, preserve its entire shared
// authorization Cell and fail before asking for a signature if it was spent.
test("public mint proof returns all shared capacity and rejects payment-constrained or changed proofs", async () => {
    const {
        addPublicMintProof,
        isPublicMintLock,
        verifyPublicMintProof,
        PUBLIC_MINT_ACP_CODE_HASH,
    } = await import("../src/app/mint/publicMint");
    const acp = ccc.Script.from({
        codeHash: PUBLIC_MINT_ACP_CODE_HASH,
        hashType: "type",
        args: lock.args,
    });
    assert.equal(isPublicMintLock(acp), true);
    assert.equal(isPublicMintLock(ccc.Script.from({ ...acp, args: `${acp.args}08` })), false);
    assert.equal(isPublicMintLock(lock), false);
    const cell = ccc.Cell.from({
        outPoint: { txHash: `0x${"44".repeat(32)}`, index: 0 },
        cellOutput: { lock: acp, capacity: 6100000000n },
        outputData: "0x",
    });
    const { tx } = transaction(1);
    const proof = addPublicMintProof(tx, cell, acp);
    verifyPublicMintProof(tx, proof, acp);
    assert.equal(tx.outputs[proof.outputIndex].capacity, cell.cellOutput.capacity);
    assert.throws(() => addPublicMintProof(tx, cell, acp), /already a funding input/);
    tx.outputs[proof.outputIndex].capacity -= 1n;
    assert.throws(() => verifyPublicMintProof(tx, proof, acp), /authorization Cell/);
});

test("a non-owner wallet signs a public mint; stale authorization never requests a signature", async () => {
    const { addPublicMintProof, PUBLIC_MINT_ACP_CODE_HASH } =
        await import("../src/app/mint/publicMint");
    const fixture = submissionFixture();
    const acp = ccc.Script.from({
        codeHash: PUBLIC_MINT_ACP_CODE_HASH,
        hashType: "type",
        args: `0x${"55".repeat(20)}`,
    });
    const cell = ccc.Cell.from({
        outPoint: { txHash: `0x${"66".repeat(32)}`, index: 0 },
        cellOutput: { lock: acp, capacity: 6100000000n },
        outputData: "0x",
    });
    fixture.plan.ownerLock = acp;
    fixture.plan.publicProof = addPublicMintProof(fixture.plan.tx, cell, acp);
    fixture.plan.txHash = fixture.plan.tx.hash();
    fixture.plan.client.getCellLive = async () => cell;
    // The mock wallet controls only `lock`, which deliberately differs from ACP.
    const receipt = await signAndSubmitMint(fixture.plan, { persist: () => {} });
    assert.equal(receipt.status, "queued");
    fixture.events.length = 0;
    fixture.plan.client.getCellLive = async () => undefined;
    await assert.rejects(signAndSubmitMint(fixture.plan, { persist: () => {} }), /Another mint/);
    assert.deepEqual(fixture.events, []);
});

test("CoBuild stays beyond added funding inputs and its bytes are included in the fee", async () => {
    const { completeMintFee } = await import("../src/app/mint/fee");
    const cells = [100n, 500n].map((capacity, index) =>
        ccc.Cell.from({
            outPoint: { txHash: `0x${String(index + 7).repeat(64)}`, index: 0 },
            cellOutput: { lock, capacity: capacity * 100000000n },
            outputData: "0x",
        }),
    );
    const { tx, records } = transaction(1);
    tx.inputs = [ccc.CellInput.from({ previousOutput: cells[0].outPoint, ...cells[0] })];
    const id = ccc.hashTypeId(tx.inputs[0], 0);
    tx.outputs[0].type!.args = id;
    records[0].sporeId = id;
    sporeA.injectCobuild(tx, [sporeA.assembleCreateSporeAction(tx.outputs[0], tx.outputsData[0])]);
    const client = {
        getCell: async (point: ccc.OutPointLike) => cells.find((cell) => cell.outPoint.eq(point)),
    } as unknown as ccc.Client;
    const signer = {
        client,
        findCells: async function* () {
            yield* cells;
        },
        getRecommendedAddressObj: async () => ({ script: lock }),
        prepareTransaction: async (value: ccc.TransactionLike) => {
            const tx = ccc.Transaction.from(value);
            tx.setWitnessArgsAt(0, ccc.WitnessArgs.from({ lock: `0x${"00".repeat(65)}` }));
            return tx;
        },
    } as unknown as ccc.Signer;
    const balanced = await completeMintFee(tx, signer, 1000n);
    assert.ok(balanced.inputs.length > 1);
    assert.ok(sporeA.unpackCommonCobuildProof(balanced.witnesses.at(-1)!));
    assert.ok(balanced.witnesses.length > balanced.inputs.length);
    assert.ok(
        (await balanced.getInputsCapacity(client)) - balanced.getOutputsCapacity() >=
            balanced.estimateFee(1000n),
    );
    verifyRecords(balanced, records);
});

test("legacy receipt endpoints are not contacted when checking light-client state", async () => {
    const { plan } = submissionFixture();
    const receipt = await signAndSubmitMint(plan, { persist: () => {} });
    receipt.rpcUrl = "https://legacy.example.invalid/";
    const result = await checkMint(receipt, {
        getHeaderByNumber: async () =>
            ({ hash: TESTNET_GENESIS }) as unknown as ccc.ClientBlockHeader,
        getCellLiveOnChain: async () => {
            throw new Error("Confirmed transaction must not have its spent inputs rechecked");
        },
        fetchTransactionStatus: async (hash) => {
            assert.equal(hash, receipt.txHash);
            return { transaction: plan.tx, status: "committed" };
        },
    });
    assert.equal(result.status, "committed");
});

test("a spent funding input stops minting before wallet approval", async () => {
    const fixture = submissionFixture();
    (fixture.plan.client as LightClientCkb).getCellLiveOnChain = async () => undefined;
    await assert.rejects(
        signAndSubmitMint(fixture.plan, { persist: () => {} }),
        /Input .* spent or unavailable/,
    );
    assert.deepEqual(fixture.events, []);
});

test("an input spent during wallet approval is rejected without entering the relay queue", async () => {
    const fixture = submissionFixture();
    let checks = 0;
    (fixture.plan.client as LightClientCkb).getCellLiveOnChain = async (point) =>
        ++checks === 1
            ? ccc.Cell.from({
                  outPoint: point,
                  cellOutput: { lock, capacity: 100000000000n },
                  outputData: "0x",
              })
            : undefined;
    const result = await signAndSubmitMint(fixture.plan, {
        persist: (receipt) => fixture.events.push(`save-${receipt.status}`),
    });
    assert.equal(result.status, "rejected");
    assert.deepEqual(fixture.events, ["sign", "save-signed", "save-rejected"]);
});

test("local pending is queued, and an explicit retry with live inputs actually requeues", async () => {
    const fixture = submissionFixture();
    const receipt = await signAndSubmitMint(fixture.plan, { persist: () => {} });
    const client = fixture.plan.client as LightClientCkb;
    client.fetchTransactionStatus = async () => ({
        transaction: fixture.plan.tx,
        status: "pending",
    });
    const checked = await checkMint(receipt, client);
    assert.equal(checked.status, "queued");
    assert.match(checked.message!, /local pending/);
    fixture.events.length = 0;
    const retried = await resubmitMint(receipt, { persist: () => {} }, client);
    assert.equal(retried.status, "queued");
    assert.deepEqual(fixture.events, ["broadcast"]);
});

test("a pending transaction with a spent input is rejected and cannot be requeued", async () => {
    const fixture = submissionFixture();
    const receipt = await signAndSubmitMint(fixture.plan, { persist: () => {} });
    const client = fixture.plan.client as LightClientCkb;
    client.fetchTransactionStatus = async () => ({
        transaction: fixture.plan.tx,
        status: "pending",
    });
    client.getCellLiveOnChain = async () => undefined;
    fixture.events.length = 0;
    const result = await resubmitMint(receipt, { persist: () => {} }, client);
    assert.equal(result.status, "rejected");
    assert.match(result.message!, /resending these signed bytes cannot repair/);
    assert.deepEqual(fixture.events, []);
});

test("synchronization failure never becomes a false spent-input rejection", async () => {
    const fixture = submissionFixture();
    const receipt = await signAndSubmitMint(fixture.plan, { persist: () => {} });
    const client = fixture.plan.client as LightClientCkb;
    client.fetchTransactionStatus = async () => ({
        transaction: fixture.plan.tx,
        status: "pending",
    });
    client.getCellLiveOnChain = async () => {
        throw new Error("Script synchronization timed out");
    };
    let persisted = false;
    fixture.events.length = 0;
    await assert.rejects(
        resubmitMint(
            receipt,
            {
                persist: () => {
                    persisted = true;
                },
            },
            client,
        ),
        /synchronization timed out/,
    );
    assert.equal(persisted, false);
    assert.deepEqual(fixture.events, []);
});

test("confirmation racing with input checks wins over spent-input rejection", async () => {
    const fixture = submissionFixture();
    const receipt = await signAndSubmitMint(fixture.plan, { persist: () => {} });
    const client = fixture.plan.client as LightClientCkb;
    let checks = 0;
    client.fetchTransactionStatus = async () => ({
        transaction: fixture.plan.tx,
        status: ++checks === 1 ? "pending" : "committed",
    });
    client.getCellLiveOnChain = async () => undefined;
    assert.equal((await checkMint(receipt, client)).status, "committed");
});

test("rejecting spent funding releases only its live authorization reservation", async () => {
    const fixture = submissionFixture();
    const authorization = ccc.Cell.from({
        outPoint: { txHash: `0x${"44".repeat(32)}`, index: 0 },
        cellOutput: { lock, capacity: 6100000000n },
        outputData: "0x",
    });
    fixture.plan.tx.inputs.push(ccc.CellInput.from({ previousOutput: authorization.outPoint }));
    fixture.plan.txHash = fixture.plan.tx.hash();
    const client = fixture.plan.client as LightClientCkb;
    const receipt = await signAndSubmitMint(fixture.plan, { persist: () => {} });
    await client.cache.markTransactions(fixture.plan.tx);
    const unrelated = ccc.OutPoint.from({ txHash: `0x${"55".repeat(32)}`, index: 0 });
    await client.cache.markUnusable(unrelated);
    client.fetchTransactionStatus = async () => ({
        transaction: fixture.plan.tx,
        status: "pending",
    });
    client.getCellLiveOnChain = async (point) =>
        ccc.OutPoint.from(point).eq(authorization.outPoint) ? authorization : undefined;
    assert.equal((await checkMint(receipt, client)).status, "rejected");
    assert.equal(await client.cache.isUnusable(authorization.outPoint), false);
    assert.equal(await client.cache.isUnusable(unrelated), true);
    assert.equal(await client.cache.isUnusable({ txHash: receipt.txHash, index: 0 }), true);
});
