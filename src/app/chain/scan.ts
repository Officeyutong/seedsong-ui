/** Testnet deployment metadata. Update alongside a new Cluster/decoder release.
 * Heights are inclusive creation heights, not light-client scan cursors.
 */
export const SCAN_DEPLOYMENTS = {
    cluster: {
        txHash: "0x23f41fabe26d45ef711ad8a1c2f169635cad16e5963f44df114b02694e1b2602",
        height: 22932334n,
    },
    decoder: {
        txHash: "0x4d54a43844847bd053b8cedf6bf70deb5cdb5904a43378f6db7c4426887a22ba",
        height: 22931557n,
    },
} as const;
export const DEFAULT_START_HEIGHT =
    SCAN_DEPLOYMENTS.cluster.height < SCAN_DEPLOYMENTS.decoder.height
        ? SCAN_DEPLOYMENTS.cluster.height
        : SCAN_DEPLOYMENTS.decoder.height;
export const START_HEIGHT_KEY = "seedsong.light.startHeight";
export const SCAN_ORIGINS_KEY = "seedsong.light.scanOrigins.v1";

/** Blank selects the published deployment default. Never round via JS Number. */
export function parseStartHeight(value: string): bigint {
    const text = value.trim();
    if (!text) return DEFAULT_START_HEIGHT;
    if (!/^\d+$/.test(text) || BigInt(text) > 0xffffffffffffffffn)
        throw new Error("Enter a whole block height between 0 and 18446744073709551615.");
    return BigInt(text);
}
export function readStartHeightInput(): string {
    try {
        const saved = localStorage.getItem(START_HEIGHT_KEY) ?? "";
        parseStartHeight(saved);
        return saved;
    } catch {
        return "";
    }
}
/** SDK cursors mean last processed block; include the requested first block. */
export function scanCursor(height: bigint): bigint {
    return height === 0n ? 0n : height - 1n;
}
/** Missing coverage metadata is conservatively rebased once, including legacy scans. */
export function needsScanReset(
    cursor: bigint,
    recordedStart: string | undefined,
    requestedStart: bigint,
): boolean {
    if (typeof recordedStart !== "string" || !/^\d+$/.test(recordedStart)) return true;
    return requestedStart < BigInt(recordedStart) || cursor < scanCursor(requestedStart);
}

/** Deployment-block progress, clamped before/after the published interval.
 * BigInt arithmetic preserves precision; the returned percentage has two decimals.
 */
export function deploymentBlockProgress(height: bigint): number {
    const low = DEFAULT_START_HEIGHT;
    const high =
        SCAN_DEPLOYMENTS.cluster.height > SCAN_DEPLOYMENTS.decoder.height
            ? SCAN_DEPLOYMENTS.cluster.height
            : SCAN_DEPLOYMENTS.decoder.height;
    if (height < low) return 0;
    if (height >= high) return 100;
    return Number(((height - low) * 10000n) / (high - low)) / 100;
}
