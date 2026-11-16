import { logInfo, logWarn } from "../diagnostics/logs";
import { ccc } from "@ckb-ccc/core";
import * as spore from "@ckb-ccc/spore";
import * as sporeA from "@ckb-ccc/spore/advanced";
import { formatDna, parseDna } from "../common/dna";
import type { DecoderReference } from "../decoder/types";

import {
    addPublicMintProof,
    findPublicMintCell,
    isPublicMintLock,
    verifyPublicMintProof,
} from "./publicMint";
import type { PublicMintProof } from "./publicMint";

import { getChainClient, type LightClientCkb } from "../chain/client";
import { addFundingInput, sameOutput, transactionFromBytes } from "../chain/codec";
import { completeMintFee } from "./fee";

export const CLUSTER_ID = "0xcac704319425b5ba589b62fb4df55307909c77db8a9ee5ead5d3e8bfaaa27abe";
export const CLUSTER_TYPE_HASH =
    "0x519d48285f2694edd2045317ccf3251fa3f2e4a00355de83db5e70ad889b93b3";
export const TESTNET_GENESIS = "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606";
export const MAX_BATCH = 50;
export const SPORE_CODE_HASH = "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d";
export interface MintRecord {
    dna: string;
    sporeId: ccc.Hex;
    outputIndex: number;
}
export type MintStatus = "signed" | "queued" | "submitted" | "committed" | "unknown" | "rejected";
export interface MintReceipt {
    schema: "seedsong-mint/1";
    createdAt: string;
    rpcUrl?: string; // Legacy receipt provenance; never used for requests.
    transport?: "light-client";
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
    transport: "light-client";
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
export async function requireTestnet(client: Pick<ccc.Client, "getHeaderByNumber">) {
    if ((await client.getHeaderByNumber(0))?.hash !== TESTNET_GENESIS)
        throw new Error("Minting this collection requires a CKB testnet light client.");
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
        logInfo("Mint", message);
        options.onProgress?.(message);
    };
    progress("Verifying CKB testnet genesis…");
    await requireTestnet(client);
    progress("Finding the Seedsong Cluster in synchronized chain data…");
    const cluster = await spore.findCluster(client, CLUSTER_ID);
    if (!cluster || cluster.cell.cellOutput.type?.hash() !== CLUSTER_TYPE_HASH)
        throw new Error("The Seedsong Cluster was not found in synchronized light-client data.");
    progress("Verifying the Cluster Cell is still live…");
    const live = await client.getCellLive(cluster.cell.outPoint, true, false);
    if (!live) throw new Error("The Cluster Cell is no longer live. Prepare again.");
    progress("Checking Cluster mint permissions and decoder release…");
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
    progress("Requesting the wallet recipient address…");
    const recipient = await signer.getRecommendedAddressObj();
    progress(`Building record 1 / ${dnas.length}…`);
    const content = (dna: string) => new TextEncoder().encode(JSON.stringify({ dna }));
    const base = ccc.Transaction.from({});
    progress("Finding the first wallet funding Cell…");
    await addFundingInput(signer, base);
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
        const permit = await findPublicMintCell(client, clusterOwner, options.signal, progress);
        publicProof = addPublicMintProof(base, permit, clusterOwner);
        const acp = await client.getKnownScript(ccc.KnownScript.AnyoneCanPay);
        if (acp.codeHash !== clusterOwner.codeHash || acp.hashType !== clusterOwner.hashType)
            throw new Error("Testnet ACP deployment mismatch.");
        await base.addCellDepInfos(client, acp.cellDeps);
    } else {
        if ((await base.findInputIndexByLock(clusterOwner, client)) === undefined) {
            await addFundingInput(new ccc.SignerCkbScriptReadonly(client, clusterOwner), base);
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
    const actions: ReturnType<typeof sporeA.assembleCreateSporeAction>[] = [];
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
    tx = await completeMintFee(tx, signer, feeRate, options.signal);
    cancelled(options.signal);
    verifyRecords(tx, records);
    if (publicProof) {
        verifyPublicMintProof(tx, publicProof, clusterOwner);
        const inputs = await Promise.all(
            tx.inputs.map((input) => client.getCell(input.previousOutput)),
        );
        if (inputs.filter((cell) => cell?.cellOutput.lock.eq(clusterOwner)).length !== 1)
            throw new Error(
                "Wallet funding overlaps the public authorization address. Fund a separate ordinary wallet address.",
            );
    }
    const fee = (await tx.getInputsCapacity(client)) - tx.getOutputsCapacity();
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
        transport: "light-client",
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
type ChainInputClient = Pick<LightClientCkb, "getCellLiveOnChain">;
export class UnavailableMintInputError extends Error {
    constructor(point: ccc.OutPoint) {
        super(
            `Input ${point.txHash}:${point.index} is spent or unavailable in synchronized chain data. Prepare a new mint with live inputs; resending these signed bytes cannot repair it.`,
        );
        this.name = "UnavailableMintInputError";
    }
}
export async function inspectMintInputs(client: ChainInputClient, tx: ccc.Transaction) {
    const live: ccc.Cell[] = [];
    let missing: ccc.OutPoint | undefined;
    for (const input of tx.inputs) {
        const cell = await client.getCellLiveOnChain(input.previousOutput);
        if (cell) live.push(cell);
        else missing ??= input.previousOutput;
    }
    return { live, missing };
}
async function requireLiveInputs(client: ccc.Client, tx: ccc.Transaction) {
    const chain = client as LightClientCkb;
    if (typeof chain.getCellLiveOnChain !== "function")
        throw new Error("Mint input checks require the Seedsong light-client adapter.");
    const { missing } = await inspectMintInputs(chain, tx);
    if (missing) throw new UnavailableMintInputError(missing);
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
    logInfo("Mint", "Rechecking network, authorization Cell and wallet before signing…");
    await requireTestnet(plan.client);
    if (plan.publicProof) {
        verifyPublicMintProof(plan.tx, plan.publicProof, plan.ownerLock);
        const live = await plan.client.getCellLive(plan.publicProof.cell.outPoint, true, true);
        if (
            !live ||
            !sameOutput(live.cellOutput, plan.publicProof.cell.cellOutput) ||
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
    logInfo("Mint", "Verifying every input is still live before wallet approval…");
    options.onProgress?.("Verifying funding and authorization Cells before wallet approval…");
    await requireLiveInputs(plan.client, plan.tx);
    logInfo("Mint", "Waiting for wallet approval…");
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
        transport: "light-client",
        clusterId: CLUSTER_ID,
        recipient: plan.recipient,
        txHash: signed.hash(),
        signedTransaction: ccc.hexFrom(signed.toBytes()),
        status: "signed",
        records: plan.records.map((record) => ({ ...record })),
        recordCapacity: plan.recordCapacity.toString(),
        fee: plan.fee.toString(),
    };
    logInfo("Mint", `Wallet signed ${receipt.txHash}; saving the receipt before broadcast.`);
    options.persist(receipt);
    options.onUpdate?.(receipt);
    if (options.isCurrent?.() === false) return receipt;
    logInfo("Mint", `Broadcasting signed transaction ${receipt.txHash}…`);
    options.onProgress?.("Queueing the signed transaction for P2P relay…");
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
        options.onProgress?.("Verifying funding and authorization Cells before queueing…");
        await requireLiveInputs(client, tx);
        options.onProgress?.("Queueing the signed transaction for P2P relay…");
        const returned = await client.sendTransaction(tx, "passthrough");
        if (returned !== receipt.txHash)
            throw new Error("Light client returned a different transaction hash.");
        next = {
            ...receipt,
            status: "queued",
            message:
                "Queued in this browser's light client. Remote peer acceptance and chain confirmation are not yet verified.",
        };
        logInfo(
            "Mint",
            `Transaction ${returned} queued locally; remote acceptance is not yet verified.`,
        );
    } catch (error) {
        logWarn(
            "Mint",
            `${error instanceof UnavailableMintInputError ? "Input validation rejected transaction" : "Queue result unknown"} ${receipt.txHash}: ${error instanceof Error ? error.message : String(error)}`,
        );
        next = {
            ...receipt,
            status: error instanceof UnavailableMintInputError ? "rejected" : "unknown",
            message: error instanceof Error ? error.message : "The broadcast result is unknown.",
        };
    }
    options.persist(next);
    options.onUpdate?.(next);
    return next;
}
/** Legacy receipt RPC URLs are ignored; query verified P2P state. */
export async function checkMint(
    receipt: MintReceipt,
    client: Pick<
        LightClientCkb,
        "getHeaderByNumber" | "fetchTransactionStatus" | "getCellLiveOnChain"
    > &
        Partial<Pick<ccc.Client, "cache">> = getChainClient(),
): Promise<MintReceipt> {
    await requireTestnet(client);
    logInfo("Mint", `Checking transaction status for ${receipt.txHash}…`);
    const tx = transactionFromBytes(receipt.signedTransaction);
    if (tx.hash() !== receipt.txHash) throw new Error("Saved signed transaction hash mismatch.");
    verifyRecords(tx, receipt.records);
    const response = await client.fetchTransactionStatus(receipt.txHash, tx);
    logInfo(
        "Mint",
        `Transaction ${receipt.txHash}: ${response?.status ?? "proof not yet available"}.`,
    );
    if (response?.transaction && response.transaction.hash() !== receipt.txHash)
        throw new Error("Verified transaction hash mismatch.");
    if (response?.status === "committed") {
        verifyRecords(response.transaction, receipt.records);
        return { ...receipt, status: "committed", message: undefined };
    }
    const { missing, live } = await inspectMintInputs(client, tx);
    if (missing) {
        // The mint itself may have confirmed while its inputs were being checked.
        const latest = await client.fetchTransactionStatus(receipt.txHash, tx);
        if (latest?.status === "committed") {
            if (latest.transaction.hash() !== receipt.txHash)
                throw new Error("Verified transaction hash mismatch.");
            verifyRecords(latest.transaction, receipt.records);
            return { ...receipt, status: "committed", message: undefined };
        }
        // Release only the live input reservations of this impossible transaction;
        // never clear other pending transactions or trust its unconfirmed outputs.
        if (client.cache) {
            await client.cache.markUnusable(
                tx.outputs.map((_, index) => ({ txHash: tx.hash(), index })),
            );
            await client.cache.markUsable(live);
        }
        return {
            ...receipt,
            status: "rejected",
            message: new UnavailableMintInputError(missing).message,
        };
    }
    if (!response)
        return {
            ...receipt,
            status: "unknown",
            message:
                "No verified confirmation proof yet. The inputs are still live; keep the light client connected and check again.",
        };
    return {
        ...receipt,
        status: "queued",
        message:
            "The SDK reports a local pending transaction, not remote acceptance. Its inputs are live; check again for a verified chain confirmation.",
    };
}
export async function resubmitMint(
    receipt: MintReceipt,
    options: Submission,
    client = getChainClient(),
): Promise<MintReceipt> {
    const checked = await checkMint(receipt, client);
    if (checked.status === "committed" || checked.status === "rejected") {
        options.persist(checked);
        options.onUpdate?.(checked);
        return checked;
    }
    const tx = transactionFromBytes(receipt.signedTransaction);
    if (tx.hash() !== receipt.txHash) throw new Error("Saved signed transaction hash mismatch.");
    verifyRecords(tx, receipt.records);
    return broadcast(tx, checked, client, options);
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
    return (entries as MintReceipt[]).map((entry) =>
        entry.status === "submitted" && entry.transport === "light-client"
            ? {
                  ...entry,
                  status: "queued",
                  message:
                      "Legacy submitted status only confirmed local queueing. Check this transaction for verified chain state.",
              }
            : entry,
    );
}
export function saveMintReceipt(receipt: MintReceipt): void {
    const entries = readMintHistory();
    const previous = entries.findIndex((entry) => entry.txHash === receipt.txHash);
    if (previous < 0) entries.unshift(receipt);
    else entries[previous] = receipt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
