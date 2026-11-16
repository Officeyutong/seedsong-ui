import { ccc } from "@ckb-ccc/core";
import { blockchain } from "@ckb-lumos/base";
/** Preserve exact serialized transaction/witness bytes from legacy receipts. */
export function transactionFromBytes(bytes: ccc.BytesLike): ccc.Transaction {
    return ccc.Transaction.from(blockchain.Transaction.unpack(ccc.bytesFrom(bytes)));
}
export function sameOutput(a: ccc.CellOutput, b: ccc.CellOutput): boolean {
    return ccc.hexFrom(a.toBytes()) === ccc.hexFrom(b.toBytes());
}
export async function addFundingInput(signer: ccc.Signer, tx: ccc.Transaction): Promise<void> {
    for await (const cell of signer.findCells(
        { scriptLenRange: [0, 1], outputDataLenRange: [0, 1] },
        true,
    )) {
        if (tx.inputs.some((input) => input.previousOutput.eq(cell.outPoint))) continue;
        tx.inputs.push(ccc.CellInput.from({ previousOutput: cell.outPoint, ...cell }));
        return;
    }
    throw new Error(
        "No synchronized ordinary funding Cell is available. Fund the wallet, wait for synchronization and retry.",
    );
}
/** CKB dep-group Cells contain a fixed vector of 36-byte OutPoints. */
export function depGroupPoints(data: ccc.BytesLike): ccc.OutPoint[] {
    const bytes = ccc.bytesFrom(data);
    if (bytes.length < 4) throw new Error("Truncated dependency group.");
    const count = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
    if (count > 256 || bytes.length !== 4 + count * 36)
        throw new Error("Invalid dependency group size.");
    return Array.from({ length: count }, (_, i) =>
        ccc.OutPoint.fromBytes(bytes.subarray(4 + i * 36, 40 + i * 36)),
    );
}
