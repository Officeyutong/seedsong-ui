import { ccc } from "@ckb-ccc/core";
import * as sporeA from "@ckb-ccc/spore/advanced";
/** Move CoBuild after all funding inputs and include its bytes in the fee. */
export async function completeMintFee(
    tx: ccc.Transaction,
    signer: ccc.Signer,
    feeRate: bigint,
    signal?: AbortSignal,
): Promise<ccc.Transaction> {
    const base = tx.clone();
    const actions = sporeA.extractCobuildActionsFromTx(base);
    if (!actions.length) throw new Error("Mint transaction has no CoBuild actions.");
    let fundingRate = feeRate;
    for (let attempt = 0; attempt < 8; attempt++) {
        signal?.throwIfAborted();
        const candidate = base.clone();
        await candidate.completeFeeBy(signer, fundingRate);
        signal?.throwIfAborted();
        sporeA.injectCobuild(candidate, actions);
        const paid =
            (await candidate.getInputsCapacity(signer.client)) - candidate.getOutputsCapacity();
        const required = candidate.estimateFee(feeRate);
        if (paid >= required) return candidate;
        if (paid <= 0n) throw new Error("Could not calculate a balanced mint fee.");
        fundingRate = (fundingRate * required + paid - 1n) / paid + 1n;
    }
    throw new Error("Could not complete a fee including the final CoBuild witness.");
}
