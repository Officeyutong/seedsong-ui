import { ccc } from "@ckb-ccc/core";
import { unzipSync, strFromU8 } from "fflate";
import type { DecoderPackage } from "./types";
const MAX_ZIP = 8 * 1024 * 1024;
const MAX_EXPANDED = 16 * 1024 * 1024;
export async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
    if (!globalThis.crypto?.subtle)
        throw new Error("On-chain decoder verification requires HTTPS or localhost.");
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
/** Verify the complete manifest before any downloaded JS is imported. */
export async function unpackDecoder(bytes: Uint8Array<ArrayBuffer>): Promise<DecoderPackage> {
    if (bytes.length > MAX_ZIP) throw new Error("Decoder ZIP exceeds the 8 MiB limit.");
    let expanded = 0;
    const names = new Set<string>();
    const files = unzipSync(bytes, {
        filter: (entry) => {
            if (!/^[a-z0-9_.-]+$/i.test(entry.name) || names.has(entry.name))
                throw new Error("ZIP contains an invalid or duplicate file name.");
            names.add(entry.name);
            expanded += entry.originalSize;
            if (names.size > 64 || expanded > MAX_EXPANDED)
                throw new Error("Decoder ZIP exceeds the extraction limits.");
            return true;
        },
    });
    function required(name: string): Uint8Array<ArrayBuffer> {
        const value = files[name];
        if (!value?.length) throw new Error(`Decoder ZIP is missing ${name}.`);
        return Uint8Array.from(value);
    }
    const manifest = JSON.parse(strFromU8(required("bundle.json")));
    if (
        manifest.schema !== "seedsong-archive/1" ||
        manifest.decoderAbiVersion !== 1 ||
        !Array.isArray(manifest.files)
    )
        throw new Error("Unsupported decoder archive schema or ABI.");
    const declared = new Set<string>();
    for (const entry of manifest.files) {
        if (
            typeof entry?.name !== "string" ||
            entry.name === "bundle.json" ||
            declared.has(entry.name)
        )
            throw new Error("Invalid decoder manifest file list.");
        declared.add(entry.name);
        const data = required(entry.name);
        if (
            data.length !== entry.bytes ||
            (await sha256(data)) !== entry.sha256 ||
            ccc.hashCkb(data) !== entry.dataHash
        )
            throw new Error(`Archive integrity check failed for ${entry.name}.`);
    }
    if (declared.size + 1 !== names.size)
        throw new Error("ZIP contains files absent from the manifest.");
    const wasm = required("decoder.wasm");
    const build = JSON.parse(strFromU8(required("decoder.json")));
    if (
        build.abiVersion !== 1 ||
        build.wasmBytes !== wasm.length ||
        build.sha256 !== (await sha256(wasm))
    )
        throw new Error("WASM does not match its build manifest.");
    const text = (name: string) => new TextDecoder("utf-8", { fatal: true }).decode(required(name));
    return {
        source: "chain",
        wasm,
        loader: text("loader.js"),
        documents: {
            pattern: text("pattern.md"),
            music: text("spec.md"),
            legacy: text("spec-v1.md"),
        },
        reference: { source: "chain", archiveHash: ccc.hashCkb(bytes), wasmHash: build.sha256 },
    };
}
