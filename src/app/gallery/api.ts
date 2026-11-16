import { ccc } from "@ckb-ccc/core";
import * as spore from "@ckb-ccc/spore";
import { unpackToRawClusterData, unpackToRawSporeData } from "@ckb-ccc/spore/advanced";
import { CLUSTER_ID, CLUSTER_TYPE_HASH, SPORE_CODE_HASH } from "../mint/api";
import { getChainClient, type LightClientCkb } from "../chain/client";
import { abortable } from "../chain/runtime";
import { TESTNET_GENESIS } from "../chain/config";
import { formatDna, parseDna } from "../common/dna";
import type { DecoderReference } from "../decoder/types";
import { logInfo, logWarn } from "../diagnostics/logs";

export interface GalleryRecord {
    id: string;
    sporeId: ccc.Hex;
    dna: string;
    outPoint: ccc.OutPoint;
    capacity: bigint;
    owner: string;
}
export interface GallerySnapshot {
    records: GalleryRecord[];
    addresses: string[];
    scannedCells: number;
    skipped: number;
    checkedAt: string;
}
type GalleryClient = Pick<LightClientCkb, "findCellsPagedNoCache"> & {
    getHeaderByNumber: (number: ccc.NumLike) => Promise<{ hash: ccc.Hex } | undefined>;
};

/** Decode only this collection's actual live outputs, never local mint receipts. */
export function decodeGalleryRecord(cell: ccc.Cell, owner: ccc.Address): GalleryRecord | null {
    const type = cell.cellOutput.type;
    if (!cell.cellOutput.lock.eq(owner.script)) return null;
    if (type?.codeHash !== SPORE_CODE_HASH || type.hashType !== "data1") return null;
    const data = unpackToRawSporeData(cell.outputData);
    if (ccc.hexFrom(data.clusterId ?? "0x") !== CLUSTER_ID) return null;
    if (data.contentType !== "dob/1") throw new Error("Unsupported Seedsong content type.");
    const value: unknown = JSON.parse(ccc.bytesTo(data.content, "utf8"));
    if (!value || typeof value !== "object" || !("dna" in value) || typeof value.dna !== "string")
        throw new Error("The Seedsong content has no DNA string.");
    if (ccc.bytesFrom(type.args).length !== 32) throw new Error("Invalid Spore ID length.");
    return {
        id: `${cell.outPoint.txHash}:${cell.outPoint.index}`,
        sporeId: type.args,
        dna: formatDna(parseDna(value.dna)),
        outPoint: cell.outPoint,
        capacity: cell.cellOutput.capacity,
        owner: owner.toString(),
    };
}

export async function loadWalletRecords(
    signer: Pick<ccc.Signer, "getAddressObjs">,
    options: { signal: AbortSignal; onProgress?: (message: string) => void },
    client: GalleryClient = getChainClient(),
): Promise<GallerySnapshot> {
    const { signal } = options;
    const wait = <T>(promise: Promise<T>) => abortable(promise, signal);
    const progress = (message: string) => {
        signal.throwIfAborted();
        options.onProgress?.(message);
        logInfo("Gallery", message);
    };
    progress("Verifying CKB testnet…");
    if ((await wait(client.getHeaderByNumber(0)))?.hash !== TESTNET_GENESIS)
        throw new Error("The gallery requires CKB testnet.");
    progress("Reading wallet addresses…");
    const addresses = [
        ...new Map((await wait(signer.getAddressObjs())).map((a) => [a.script.hash(), a])).values(),
    ];
    if (!addresses.length) throw new Error("The connected wallet returned no addresses.");
    if (addresses.some((address) => address.prefix !== "ckt"))
        throw new Error("Switch your wallet to CKB testnet before loading the gallery.");
    const records = new Map<string, GalleryRecord>();
    let scannedCells = 0;
    let skipped = 0;
    for (const [index, address] of addresses.entries()) {
        let after: string | undefined;
        const cursors = new Set<string>();
        do {
            progress(
                `Synchronizing wallet address ${index + 1}/${addresses.length}; ${scannedCells} Cells checked, ${records.size} records found…`,
            );
            const page = await wait(
                client.findCellsPagedNoCache(
                    {
                        script: address.script,
                        scriptType: "lock",
                        scriptSearchMode: "exact",
                        withData: true,
                    },
                    "desc",
                    100,
                    after,
                ),
            );
            signal.throwIfAborted();
            for (const cell of page.cells) {
                scannedCells++;
                try {
                    const record = decodeGalleryRecord(cell, address);
                    if (record) records.set(record.id, record);
                } catch {
                    skipped++;
                    logWarn(
                        "Gallery",
                        `Skipping an unsupported Spore at ${cell.outPoint.txHash}:${cell.outPoint.index}.`,
                    );
                }
            }
            if (!page.cells.length) break;
            if (!page.lastCursor || cursors.has(page.lastCursor))
                throw new Error(
                    "The light client returned a repeated gallery cursor. Reconnect and refresh.",
                );
            cursors.add(page.lastCursor);
            after = page.lastCursor;
        } while (after);
    }
    progress(`Loaded ${records.size} Seedsong record(s) from ${scannedCells} synchronized Cells.`);
    return {
        records: [...records.values()],
        addresses: addresses.map(String),
        scannedCells,
        skipped,
        checkedAt: new Date().toISOString(),
    };
}

/** The selected engine must match the collection's pinned music release. */
export async function verifyGalleryDecoder(reference: DecoderReference) {
    const cluster = await spore.findCluster(getChainClient(), CLUSTER_ID);
    if (!cluster || cluster.cell.cellOutput.type?.hash() !== CLUSTER_TYPE_HASH)
        throw new Error(
            "The Seedsong Cluster could not be verified. Wait for synchronization and retry.",
        );
    const metadata = JSON.parse(unpackToRawClusterData(cluster.cell.outputData).description);
    const release = metadata?.seedsong?.music?.decoder;
    if (
        !reference.wasmHash ||
        reference.wasmHash !== release?.wasm_sha256 ||
        (reference.source === "chain" && reference.archiveHash !== release?.data_hash)
    )
        throw new Error(
            "The selected decoder differs from the collection's release. Open Settings and load the deployed decoder ZIP before playing these records.",
        );
}
