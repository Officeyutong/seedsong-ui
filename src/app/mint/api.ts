import { ccc } from "@ckb-ccc/core";
import { spore } from "@ckb-ccc/spore";
import { sporeA } from "@ckb-ccc/spore/advanced";
import { formatDna, parseDna } from "../common/dna";
import type { DecoderReference } from "../decoder/types";

import {
    addPublicMintProof,
    findPublicMintCell,
    isPublicMintLock,
    verifyPublicMintProof,
} from "./publicMint";
import type { PublicMintProof } from "./publicMint";

export const CLUSTER_ID = "0xcac704319425b5ba589b62fb4df55307909c77db8a9ee5ead5d3e8bfaaa27abe";
export const CLUSTER_TYPE_HASH =
    "0x519d48285f2694edd2045317ccf3251fa3f2e4a00355de83db5e70ad889b93b3";
export const TESTNET_GENESIS = "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606";
export const MAX_BATCH = 50;
const SPORE_CODE_HASH = "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d";
export interface MintRecord {
    dna: string;
    sporeId: ccc.Hex;
    outputIndex: number;
}
export type MintStatus = "signed" | "submitted" | "committed" | "unknown" | "rejected";
export interface MintReceipt {
    schema: "seedsong-mint/1";
    createdAt: string;
    rpcUrl: string;
    clusterId: string;
    recipient: string;
    txHash: ccc.Hex;
    signedTransaction: ccc.Hex;
    status: MintStatus;
    records: MintRecord[];
    recordCapacity: string;
    fee: string;
    message?: string;
}
export interface MintPlan {
    tx: ccc.Transaction;
    signer: ccc.Signer;
    client: ccc.Client;
    txHash: ccc.Hex;
    records: MintRecord[];
    recipient: string;
    clusterOwner: string;
    ownerLock: ccc.Script;
    publicProof?: PublicMintProof;
    recordCapacity: bigint;
    fee: bigint;
    feeRate: bigint;
    rpcUrl: string;
}
interface Operation {
    signal?: AbortSignal;
    onProgress?: (message: string) => void;
}
function cancelled(signal?: AbortSignal) {
    signal?.throwIfAborted();
}
export function normalizeDnas(values: string[]): string[] {
    if (!values.length || values.length > MAX_BATCH)
        throw new Error(`Choose 1–${MAX_BATCH} DNA values.`);
    const normalized = values.map((dna) => formatDna(parseDna(dna)));
    if (new Set(normalized).size !== normalized.length)
        throw new Error("Duplicate DNA values in this batch. Generate again or remove duplicates.");
    return normalized;
}
/** Unique CSPRNG DNA, or use a supplied Seedsong engine randomDna function. */
export async function generateBatchDna(
    count: number,
    options: Operation & { randomDna?: () => Promise<string> } = {},
): Promise<string[]> {
    if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH)
        throw new Error(`Batch size must be an integer from 1 to ${MAX_BATCH}.`);
    const unique = new Set<string>();
    for (let attempt = 0; unique.size < count && attempt < count * 8; attempt++) {
        cancelled(options.signal);
        const dna = options.randomDna
            ? await options.randomDna()
            : formatDna(crypto.getRandomValues(new Uint8Array(32)));
        unique.add(formatDna(parseDna(dna)));
        options.onProgress?.(`Generating DNA ${unique.size} / ${count}…`);
    }
    cancelled(options.signal);
    if (unique.size !== count)
        throw new Error("The random source produced too many duplicate DNA values.");
    return [...unique];
}
export async function requireTestnet(client: ccc.Client) {
    if ((await client.getHeaderByNumber(0))?.hash !== TESTNET_GENESIS)
        throw new Error("Minting this collection requires a CKB testnet RPC.");
}
async function requireOwner(signer: ccc.Signer, lock: ccc.Script) {
    if (!(await signer.getAddressObjs()).some((address) => address.script.eq(lock))) {
        throw new Error(
            `Public minting has not been enabled on chain yet. The collection administrator must run cluster-open first. Owner wallet: ${ccc.Address.fromScript(lock, signer.client)}.`,
        );
    }
}
/** One atomic transaction for the complete batch. No signature or broadcast. */
export async function prepareMint(
    signer: ccc.Signer,
    values: string[],
    reference: DecoderReference,
    options: Operation & { feeRate?: bigint } = {},
): Promise<MintPlan> {
    const dnas = normalizeDnas(values);
    const feeRate = options.feeRate ?? 1000n;
    if (feeRate < 1n || feeRate > 100_000n)
        throw new Error("Fee rate must be from 1 to 100000 shannons per 1000 bytes.");
    const client = signer.client;
    const progress = (message: string) => {
        cancelled(options.signal);
        options.onProgress?.(message);
    };
    progress("Checking network and Cluster permissions…");
    await requireTestnet(client);
    const cluster = await spore.findCluster(client, CLUSTER_ID);
    if (!cluster || cluster.cell.cellOutput.type?.hash() !== CLUSTER_TYPE_HASH)
        throw new Error("The Seedsong Cluster was not found on this RPC.");
    const live = await client.getCellLive(cluster.cell.outPoint, true, false);
    if (!live) throw new Error("The Cluster Cell is no longer live. Prepare again.");
    const clusterOwner = live.cellOutput.lock;
    const publicMint = isPublicMintLock(clusterOwner);
    if (!publicMint) await requireOwner(signer, clusterOwner);
    const metadata = JSON.parse(sporeA.unpackToRawClusterData(live.outputData).description);
    const released = metadata?.seedsong?.music?.decoder;
    if (
        released?.wasm_sha256 !== reference.wasmHash ||
        (reference.source === "chain" && released?.data_hash !== reference.archiveHash)
    ) {
        throw new Error(
            "The selected decoder differs from this Cluster's release. Load the deployed ZIP in Decoder source before minting.",
        );
    }
    const recipient = await signer.getRecommendedAddressObj();
    progress(`Building record 1 / ${dnas.length}…`);
    const content = (dna: string) => new TextEncoder().encode(JSON.stringify({ dna }));
    const base = ccc.Transaction.from({});
    await base.completeInputsAtLeastOne(signer);
    let publicProof: PublicMintProof | undefined;
    if (publicMint) {
        if (
            recipient.script.eq(clusterOwner) ||
            (await base.findInputIndexByLock(clusterOwner, client)) !== undefined
        ) {
            throw new Error(
                "Use an ordinary funded wallet address, separate from the collection's authorization address.",
            );
        }
        progress("Finding a public mint authorization Cell…");
        const permit = await findPublicMintCell(client, clusterOwner, options.signal);
        publicProof = addPublicMintProof(base, permit, clusterOwner);
        const acp = await client.getKnownScript(ccc.KnownScript.AnyoneCanPay);
        if (acp.codeHash !== clusterOwner.codeHash || acp.hashType !== clusterOwner.hashType)
            throw new Error("RPC ACP deployment mismatch.");
        await base.addCellDepInfos(client, acp.cellDeps);
    } else {
        if ((await base.findInputIndexByLock(clusterOwner, client)) === undefined) {
            await base.completeInputsAddOne(new ccc.SignerCkbScriptReadonly(client, clusterOwner));
        }
        if ((await base.findInputIndexByLock(clusterOwner, client)) === undefined)
            throw new Error("No funding Cell can prove Cluster-owner authorization.");
        if (!recipient.script.eq(clusterOwner)) base.addOutput({ lock: clusterOwner }, "0x");
    }
    base.addCellDeps({ outPoint: live.outPoint, depType: "code" });
    let { tx, id } = await spore.createSpore({
        signer,
        tx: base,
        to: recipient.script,
        data: { contentType: "dob/1", content: content(dnas[0]), clusterId: CLUSTER_ID },
        clusterMode: "skip",
    });
    const firstIndex = tx.outputs.findIndex((output) => output.type?.args === id);
    if (firstIndex < 0) throw new Error("The Spore SDK did not return the first record output.");
    const records: MintRecord[] = [{ dna: dnas[0], sporeId: id, outputIndex: firstIndex }];
    const info = spore.getSporeScriptInfo(client);
    const actions: ccc.EncodableType<typeof sporeA.Action>[] = [];
    // Install the Cluster lock proof once, then append further outputs/actions.
    // This avoids duplicating lock-proxy outputs or querying the Cluster per DNA.
    for (const dna of dnas.slice(1)) {
        progress(`Building record ${records.length + 1} / ${dnas.length}…`);
        const outputIndex = tx.outputs.length;
        id = ccc.hashTypeId(tx.inputs[0], outputIndex);
        const packed = sporeA.packRawSporeData({
            contentType: "dob/1",
            content: content(dna),
            clusterId: CLUSTER_ID,
        });
        tx.addOutput(
            {
                lock: recipient.script,
                type: { codeHash: info.codeHash, hashType: info.hashType, args: id },
            },
            packed,
        );
        actions.push(sporeA.assembleCreateSporeAction(tx.outputs[outputIndex], packed));
        records.push({ dna, sporeId: id, outputIndex });
    }
    if (actions.length) tx = await sporeA.prepareSporeTransaction(signer, tx, actions);
    progress("Selecting funding Cells and calculating fees…");
    await tx.completeFeeBy(signer, feeRate);
    cancelled(options.signal);
    verifyRecords(tx, records);
    if (publicProof) {
        verifyPublicMintProof(tx, publicProof, clusterOwner);
        const inputs = await Promise.all(tx.inputs.map((input) => input.getCell(client)));
        if (inputs.filter((cell) => cell.cellOutput.lock.eq(clusterOwner)).length !== 1)
            throw new Error(
                "Wallet funding overlaps the public authorization address. Fund a separate ordinary wallet address.",
            );
    }
    const fee = await tx.getFee(client);
    if (fee < 0n) throw new Error("The mint transaction is not balanced.");
    return {
        tx,
        signer,
        client,
        txHash: tx.hash(),
        records,
        recipient: recipient.toString(),
        clusterOwner: ccc.Address.fromScript(clusterOwner, client).toString(),
        ownerLock: clusterOwner,
        publicProof,
        recordCapacity: records.reduce(
            (sum, record) => sum + tx.outputs[record.outputIndex].capacity,
            0n,
        ),
        fee,
        feeRate,
        rpcUrl: client.url,
    };
}
export function verifyRecords(tx: ccc.Transaction, records: MintRecord[]) {
    normalizeDnas(records.map((record) => record.dna));
    const used = new Set<number>();
    for (const record of records) {
        if (!Number.isInteger(record.outputIndex) || record.outputIndex < 0)
            throw new Error("Invalid record output index.");
        if (used.has(record.outputIndex)) throw new Error("Duplicate record output index.");
        used.add(record.outputIndex);
        if (formatDna(parseDna(record.dna)) !== record.dna)
            throw new Error("Non-canonical record DNA.");
        const output = tx.outputs[record.outputIndex];
        const data = tx.outputsData[record.outputIndex];
        if (
            !output?.type ||
            output.type.codeHash !== SPORE_CODE_HASH ||
            output.type.hashType !== "data1" ||
            output.type.args !== record.sporeId ||
            !tx.inputs[0] ||
            ccc.hashTypeId(tx.inputs[0], record.outputIndex) !== record.sporeId ||
            data === undefined
        )
            throw new Error("The transaction changed a reviewed Spore ID.");
        const decoded = sporeA.unpackToRawSporeData(data);
        if (
            decoded.contentType !== "dob/1" ||
            ccc.hexFrom(decoded.clusterId ?? "0x") !== CLUSTER_ID ||
            ccc.bytesTo(decoded.content, "utf8") !== JSON.stringify({ dna: record.dna })
        )
            throw new Error("The transaction changed a reviewed DNA or Cluster.");
    }
}
interface Submission {
    /** Must persist successfully before any broadcast is attempted. */
    persist: (receipt: MintReceipt) => void;
    onUpdate?: (receipt: MintReceipt) => void;
    onProgress?: (message: string) => void;
    isCurrent?: () => boolean;
}
/** Sign the reviewed raw transaction, save it, then broadcast exactly those bytes. */
export async function signAndSubmitMint(plan: MintPlan, options: Submission): Promise<MintReceipt> {
    if (plan.tx.hash() !== plan.txHash || options.isCurrent?.() === false)
        throw new Error("The wallet or mint preview changed. Prepare again.");
    await requireTestnet(plan.client);
    if (plan.publicProof) {
        verifyPublicMintProof(plan.tx, plan.publicProof, plan.ownerLock);
        const live = await plan.client.getCellLive(plan.publicProof.cell.outPoint, true, true);
        if (
            !live ||
            !live.cellOutput.eq(plan.publicProof.cell.cellOutput) ||
            live.outputData !== "0x"
        )
            throw new Error(
                "Another mint used this authorization Cell. Prepare a fresh transaction; nothing was broadcast.",
            );
    } else {
        if (isPublicMintLock(plan.ownerLock))
            throw new Error("Missing public mint authorization proof.");
        await requireOwner(plan.signer, plan.ownerLock);
    }
    if ((await plan.signer.getRecommendedAddress()) !== plan.recipient)
        throw new Error("Wallet account changed. Prepare again.");
    options.onProgress?.("Waiting for wallet approval…");
    const signed = await plan.signer.signTransaction(plan.tx.clone());
    if (signed.hash() !== plan.txHash)
        throw new Error(
            "The wallet changed the reviewed transaction. Nothing was broadcast; prepare a new preview.",
        );
    verifyRecords(signed, plan.records);
    if (plan.publicProof) verifyPublicMintProof(signed, plan.publicProof, plan.ownerLock);
    const receipt: MintReceipt = {
        schema: "seedsong-mint/1",
        createdAt: new Date().toISOString(),
        rpcUrl: plan.rpcUrl,
        clusterId: CLUSTER_ID,
        recipient: plan.recipient,
        txHash: signed.hash(),
        signedTransaction: ccc.hexFrom(signed.toBytes()),
        status: "signed",
        records: plan.records.map((record) => ({ ...record })),
        recordCapacity: plan.recordCapacity.toString(),
        fee: plan.fee.toString(),
    };
    options.persist(receipt);
    options.onUpdate?.(receipt);
    if (options.isCurrent?.() === false) return receipt;
    options.onProgress?.("Broadcasting the signed transaction…");
    return broadcast(signed, receipt, plan.client, options);
}
async function broadcast(
    tx: ccc.Transaction,
    receipt: MintReceipt,
    client: ccc.Client,
    options: Submission,
): Promise<MintReceipt> {
    let next: MintReceipt;
    try {
        const returned = await client.sendTransaction(tx, "passthrough");
        if (returned !== receipt.txHash)
            throw new Error("RPC returned a different transaction hash.");
        next = { ...receipt, status: "submitted", message: undefined };
    } catch (error) {
        next = {
            ...receipt,
            status: "unknown",
            message: error instanceof Error ? error.message : "The broadcast result is unknown.",
        };
    }
    options.persist(next);
    options.onUpdate?.(next);
    return next;
}
/** Query the original RPC. Never creates or sends a transaction. */
export async function checkMint(receipt: MintReceipt): Promise<MintReceipt> {
    const owner = ccc.ClientPublicTestnet.open({ urls: [receipt.rpcUrl], timeout: 30_000 });
    try {
        await requireTestnet(owner.value);
        const response = await owner.value.getTransactionNoCache(receipt.txHash);
        if (!response)
            return {
                ...receipt,
                status: "unknown",
                message:
                    "This RPC has not found the transaction yet. Do not create a replacement mint automatically.",
            };
        if (response.status === "rejected")
            return { ...receipt, status: "rejected", message: response.reason };
        if (response.transaction.hash() !== receipt.txHash)
            throw new Error("RPC transaction hash mismatch.");
        verifyRecords(response.transaction, receipt.records);
        return {
            ...receipt,
            status: response.status === "committed" ? "committed" : "submitted",
            message: undefined,
        };
    } finally {
        await owner.dispose();
    }
}
/** Recover an uncertain submission by broadcasting the same signed transaction. */
export async function resubmitMint(
    receipt: MintReceipt,
    options: Submission,
): Promise<MintReceipt> {
    const checked = await checkMint(receipt);
    if (checked.status !== "unknown") {
        options.persist(checked);
        options.onUpdate?.(checked);
        return checked;
    }
    const tx = ccc.Transaction.fromBytes(ccc.bytesFrom(receipt.signedTransaction));
    if (tx.hash() !== receipt.txHash) throw new Error("Saved signed transaction hash mismatch.");
    verifyRecords(tx, receipt.records);
    const owner = ccc.ClientPublicTestnet.open({ urls: [receipt.rpcUrl], timeout: 30_000 });
    try {
        return await broadcast(tx, receipt, owner.value, options);
    } finally {
        await owner.dispose();
    }
}
const STORAGE_KEY = "seedsong.mints.v1";
export function readMintHistory(): MintReceipt[] {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return [];
    const entries: unknown = JSON.parse(text);
    if (
        !Array.isArray(entries) ||
        !entries.every(
            (entry: MintReceipt) =>
                entry != null &&
                entry.schema === "seedsong-mint/1" &&
                Array.isArray(entry.records) &&
                typeof entry.txHash === "string" &&
                typeof entry.signedTransaction === "string",
        )
    )
        throw new Error(
            "Saved mint history is unreadable. Export or recover browser storage before minting.",
        );
    return entries;
}
export function saveMintReceipt(receipt: MintReceipt): void {
    const entries = readMintHistory();
    const previous = entries.findIndex((entry) => entry.txHash === receipt.txHash);
    if (previous < 0) entries.unshift(receipt);
    else entries[previous] = receipt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
