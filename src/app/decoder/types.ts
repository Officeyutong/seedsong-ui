import type { Dob0Pattern, Dob1Pattern, Traits } from "../common/types";
export interface DecoderSettings {
    source: "bundled" | "chain";
    rpcUrl: string;
    txHash: string;
    index: number;
}
export const DEFAULT_SETTINGS: DecoderSettings = {
    source: "bundled",
    rpcUrl: "https://testnet.ckb.dev/",
    txHash: "0x4d54a43844847bd053b8cedf6bf70deb5cdb5904a43378f6db7c4426887a22ba",
    index: 0,
};
export interface DecoderDocuments {
    pattern: string;
    music: string;
    legacy: string;
}
export interface DecoderReference {
    source: "bundled" | "chain";
    rpcUrl?: string;
    txHash?: string;
    index?: number;
    genesisHash?: string;
    archiveHash?: string;
    wasmHash?: string;
}
/** Retained in memory to restart a cancelled Worker without refetching the Cell. */
export interface DecoderPackage {
    source: "bundled" | "chain";
    documents: DecoderDocuments;
    reference: DecoderReference;
    wasm?: Uint8Array<ArrayBuffer>;
    loader?: string;
}
export interface DecoderInfo {
    package: DecoderPackage;
    patterns: { dob0Pattern: Dob0Pattern; dob1Pattern: Dob1Pattern };
}
export interface CoverResult {
    dna: string;
    traits: Traits;
    svg: string;
}
export function normalizeSettings(value: DecoderSettings): DecoderSettings {
    if (value.source !== "chain" && value.source !== "bundled")
        throw new Error("Choose a decoder source.");
    if (value.source === "bundled") return { ...value, source: "bundled" };
    let url: URL;
    try {
        url = new URL(value.rpcUrl.trim());
    } catch {
        throw new Error("Enter a valid RPC URL.");
    }
    if (!["https:", "http:"].includes(url.protocol))
        throw new Error("RPC URLs must use HTTP or HTTPS.");
    const match = /^(0x[0-9a-f]{64})(?::(0x[0-9a-f]+|\d+))?$/i.exec(value.txHash.trim());
    if (!match)
        throw new Error("Enter a 0x-prefixed transaction hash, optionally followed by :index.");
    const index = match[2] === undefined ? value.index : Number(match[2]);
    if (!Number.isSafeInteger(index) || index < 0 || index > 0xffffffff)
        throw new Error("Output index must be an integer from 0 to 4294967295.");
    return { source: "chain", rpcUrl: url.href, txHash: match[1].toLowerCase(), index };
}
export function readSettings(): DecoderSettings {
    try {
        const saved = JSON.parse(localStorage.getItem("seedsong.decoder") ?? "null");
        return saved
            ? normalizeSettings({ ...DEFAULT_SETTINGS, ...saved })
            : { ...DEFAULT_SETTINGS };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}
