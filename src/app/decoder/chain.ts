import { logInfo } from "../diagnostics/logs";
import { ccc } from "@ckb-ccc/core";
import { getChainClient } from "../chain/client";
import { chainRuntime } from "../chain/runtime";
import { TESTNET_GENESIS } from "../chain/config";
import type { DecoderArchive, DecoderSettings } from "./types";
export async function fetchDecoderArchive(
    settings: DecoderSettings,
    progress: (message: string) => void,
    signal?: AbortSignal,
): Promise<DecoderArchive> {
    logInfo("Decoder", `Fetching chain ZIP at ${settings.txHash}:${settings.index}…`);
    progress("Fetching decoder transaction proof from CKB peers…");
    const response = await chainRuntime.transaction(settings.txHash, signal);
    if (!response || response.status !== "committed")
        throw new Error(
            "Decoder transaction is not yet verified as committed. Wait for synchronization and retry.",
        );
    const data = response.transaction.outputsData[settings.index];
    if (data === undefined) throw new Error("The decoder transaction has no output at this index.");
    progress("Synchronizing the decoder script to check Cell liveness…");
    const live = await getChainClient().getCellLive(
        { txHash: settings.txHash, index: settings.index },
        false,
    );
    signal?.throwIfAborted();
    if (!live) throw new Error("The synchronized decoder Cell is spent or unavailable.");
    logInfo("Decoder", `Decoder Cell verified live; ZIP size ${ccc.bytesFrom(data).length} bytes.`);
    return {
        source: "chain",
        archive: Uint8Array.from(ccc.bytesFrom(data)),
        reference: {
            source: "chain",
            transport: "light-client",
            txHash: settings.txHash,
            index: settings.index,
            genesisHash: TESTNET_GENESIS,
        },
    };
}
