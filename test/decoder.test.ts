import assert from "node:assert/strict";
import test from "node:test";
import { ccc } from "@ckb-ccc/core";
import { zipSync, strToU8 } from "fflate";
import { unpackDecoder, sha256 } from "../src/app/decoder/archive";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/app/decoder/types";
async function fixture() {
    const wasm = Uint8Array.from([0, 97, 115, 109, 1, 0, 0, 0]);
    const files: Record<string, Uint8Array<ArrayBuffer>> = {
        "decoder.wasm": wasm,
        "loader.js": strToU8("export async function loadSeedsong() {}"),
        "decoder.json": strToU8(
            JSON.stringify({ abiVersion: 1, wasmBytes: wasm.length, sha256: await sha256(wasm) }),
        ),
        "pattern.md": strToU8("pattern fixture"),
        "spec.md": strToU8("music fixture"),
        "spec-v1.md": strToU8("legacy fixture"),
    };
    const entries = await Promise.all(
        Object.entries(files).map(async ([name, data]) => ({
            name,
            bytes: data.length,
            sha256: await sha256(data),
            dataHash: ccc.hashCkb(data),
        })),
    );
    files["bundle.json"] = strToU8(
        JSON.stringify({ schema: "seedsong-archive/1", decoderAbiVersion: 1, files: entries }),
    );
    return files;
}
test("source settings normalize a hash:index without hiding invalid endpoints", () => {
    const value = normalizeSettings({
        ...DEFAULT_SETTINGS,
        source: "chain",
        txHash: `${DEFAULT_SETTINGS.txHash}:0x2`,
    });
    assert.equal(value.index, 2);
    assert.equal(value.txHash, DEFAULT_SETTINGS.txHash);
    for (const change of [
        { rpcUrl: "invalid" },
        { rpcUrl: "file:///tmp/decoder" },
        { txHash: "0x123" },
        { index: -1 },
        { index: 0.5 },
    ]) {
        assert.throws(() => normalizeSettings({ ...DEFAULT_SETTINGS, source: "chain", ...change }));
    }
});
test("ZIP decoder preserves the archived documents and validates both hash formats", async () => {
    const files = await fixture();
    const bytes = zipSync(files);
    const decoded = await unpackDecoder(bytes);
    assert.equal(decoded.documents.music, "music fixture");
    assert.equal(decoded.documents.legacy, "legacy fixture");
    assert.deepEqual(decoded.wasm, files["decoder.wasm"]);
    assert.equal(decoded.reference.archiveHash, ccc.hashCkb(bytes));
});
test("tampered or undeclared archive content is rejected before loading JS", async () => {
    const files = await fixture();
    files["loader.js"] = strToU8("changed code");
    await assert.rejects(unpackDecoder(zipSync(files)), /integrity/);
    const extra = await fixture();
    extra["extra.js"] = strToU8("undeclared");
    await assert.rejects(unpackDecoder(zipSync(extra)), /absent from/);
    const paths = await fixture();
    paths["../outside"] = strToU8("invalid path");
    await assert.rejects(unpackDecoder(zipSync(paths)), /invalid or duplicate/);
});
