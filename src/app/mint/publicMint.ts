import { ccc } from "@ckb-ccc/core";

/** Official testnet ACP deployment, with no minimum-payment arguments. */
export const PUBLIC_MINT_ACP_CODE_HASH =
    "0x3419a1c09eb2567f6552ee7a8ecffd64155cffe0f1796e6e61ec088d740c1356";
export interface PublicMintProof {
    cell: ccc.Cell;
    outputIndex: number;
}
export function isPublicMintLock(lock: ccc.Script): boolean {
    return (
        lock.codeHash === PUBLIC_MINT_ACP_CODE_HASH &&
        lock.hashType === "type" &&
        ccc.bytesFrom(lock.args).length === 20
    );
}
/** Keep the public authorization Cell's entire capacity; it cannot fund a mint. */
export function addPublicMintProof(
    tx: ccc.Transaction,
    cell: ccc.Cell,
    lock: ccc.Script,
): PublicMintProof {
    if (
        !isPublicMintLock(lock) ||
        !cell.cellOutput.lock.eq(lock) ||
        cell.cellOutput.type ||
        cell.outputData !== "0x"
    ) {
        throw new Error("Invalid public mint authorization Cell.");
    }
    if (tx.inputs.some((input) => input.previousOutput.eq(cell.outPoint))) {
        throw new Error(
            "The authorization Cell is already a funding input. Use an ordinary funded wallet address.",
        );
    }
    const outputIndex = tx.outputs.length;
    tx.addInput(cell);
    tx.addOutput(cell.cellOutput.clone(), cell.outputData);
    const proof = { cell, outputIndex };
    verifyPublicMintProof(tx, proof, lock);
    return proof;
}
export function verifyPublicMintProof(
    tx: ccc.Transaction,
    proof: PublicMintProof,
    lock: ccc.Script,
): void {
    const original = proof.cell;
    const output = tx.outputs[proof.outputIndex];
    if (
        !isPublicMintLock(lock) ||
        !original.cellOutput.lock.eq(lock) ||
        original.cellOutput.type ||
        original.outputData !== "0x" ||
        tx.inputs.filter((input) => input.previousOutput.eq(original.outPoint)).length !== 1 ||
        tx.outputs.filter((output) => output.lock.eq(lock)).length !== 1 ||
        !output ||
        !output.lock.eq(lock) ||
        output.type ||
        output.capacity !== original.cellOutput.capacity ||
        tx.outputsData[proof.outputIndex] !== "0x"
    ) {
        throw new Error("The transaction changed the public mint authorization Cell.");
    }
}
/** Indexer candidates are checked against the transaction pool before use. */
export async function findPublicMintCell(
    client: ccc.Client,
    lock: ccc.Script,
    signal?: AbortSignal,
): Promise<ccc.Cell> {
    let scanned = 0;
    for await (const candidate of client.findCells(
        {
            script: lock,
            scriptType: "lock",
            scriptSearchMode: "exact",
            withData: true,
            filter: { scriptLenRange: [0, 1], outputDataLenRange: [0, 1] },
        },
        "desc",
        16,
    )) {
        signal?.throwIfAborted();
        const live = await client.getCellLive(candidate.outPoint, true, true);
        if (
            live &&
            live.cellOutput.lock.eq(lock) &&
            !live.cellOutput.type &&
            live.outputData === "0x"
        )
            return live;
        if (++scanned >= 64) break;
    }
    throw new Error(
        "Public mint authorization Cells are busy or unavailable. Wait for pending mints to confirm, then prepare again.",
    );
}
