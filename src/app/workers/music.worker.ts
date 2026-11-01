/// <reference lib="webworker" />
import type { Seedsong, Dob0Pattern, Dob1Pattern } from "seedsong-js";
import bundledManifest from "../../../vendor/seedsong-base/wasm/seedsong-js/dist/decoder.json?raw";
import { fetchDecoder } from "../decoder/archive";
import type { DecoderPackage, DecoderSettings } from "../decoder/types";
import type { MusicRequest, MusicResponse } from "./types";
import { parsePatternDocument } from "../common/patterns";
import { patternUrl, musicSpecUrl, legacySpecUrl } from "../common/specifications";
const scope = self as unknown as DedicatedWorkerGlobalScope;
let music: Seedsong | undefined;
let patterns: ReturnType<typeof parsePatternDocument> | undefined;
function send(response: MusicResponse, transfer: Transferable[] = []) {
    scope.postMessage(response, transfer);
}
async function document(url: string) {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Could not load bundled documents (HTTP ${response.status}).`);
    return response.text();
}
async function initialize(
    source: DecoderSettings | DecoderPackage,
    progress: (message: string) => void,
): Promise<DecoderPackage> {
    let bundle: DecoderPackage;
    if ("documents" in source) bundle = source;
    else if (source.source === "chain") bundle = await fetchDecoder(source, progress);
    else {
        progress("Loading bundled decoder and documents…");
        const [pattern, music, legacy] = await Promise.all([
            document(patternUrl),
            document(musicSpecUrl),
            document(legacySpecUrl),
        ]);
        bundle = {
            source: "bundled",
            documents: { pattern, music, legacy },
            reference: { source: "bundled", wasmHash: JSON.parse(bundledManifest).sha256 },
        };
    }
    // Reject unsupported editor patterns before executing the selected decoder.
    patterns = parsePatternDocument(bundle.documents.pattern);
    progress("Initializing the music decoder…");
    if (bundle.source === "bundled") music = await (await import("seedsong-js")).createSeedsong();
    else {
        if (!bundle.wasm || !bundle.loader) throw new Error("Incomplete decoder package.");
        const url = URL.createObjectURL(new Blob([bundle.loader], { type: "text/javascript" }));
        try {
            const module = (await import(/* @vite-ignore */ url)) as {
                loadSeedsong?: (wasm: Uint8Array<ArrayBuffer>) => Promise<Seedsong>;
            };
            if (typeof module.loadSeedsong !== "function")
                throw new Error("The archive loader does not export loadSeedsong.");
            music = await module.loadSeedsong(bundle.wasm);
        } finally {
            URL.revokeObjectURL(url);
        }
    }
    for (const name of [
        "randomDna",
        "renderWav",
        "decodeDob0",
        "decodeDob1",
        "generateMusic",
    ] as const) {
        if (typeof music?.[name] !== "function") throw new Error(`Decoder is missing ${name}.`);
    }
    // An initialization check catches incompatible decoder/pattern combinations
    // before the active source is replaced.
    const traits = music.decodeDob0({
        dna: "00".repeat(32),
        pattern: patterns.dob0Pattern as Dob0Pattern,
    });
    const image = music
        .decodeDob1({ traits, pattern: patterns.dob1Pattern as Dob1Pattern })
        .find((t) => t.name === "IMAGE")?.traits[0]?.SVG;
    if (typeof image !== "string" || !image.startsWith("<svg"))
        throw new Error("The decoder did not return an SVG cover.");
    return bundle;
}
scope.onmessage = async (event: MessageEvent<MusicRequest>) => {
    const request = event.data;
    try {
        if (request.type === "init") {
            const bundle = await initialize(request.source, (message) =>
                send({ type: "progress", id: request.id, message }),
            );
            send({
                type: "success",
                id: request.id,
                value: { package: bundle, patterns: patterns! },
            });
            return;
        }
        if (!music || !patterns) throw new Error("Initialize a decoder before generating content.");
        if (request.type === "random")
            send({ type: "success", id: request.id, value: music.randomDna() });
        else if (request.type === "cover") {
            const decoded = music.decodeDob0({
                dna: request.dna,
                pattern: patterns.dob0Pattern as Dob0Pattern,
            });
            const traits: Record<string, string | number> = {};
            for (const item of decoded) {
                const value = Object.values(item.traits[0] ?? {})[0];
                if (typeof value !== "string" && typeof value !== "number")
                    throw new Error(`Unsupported trait ${item.name}.`);
                traits[item.name] = value;
            }
            const svg = music
                .decodeDob1({ traits: decoded, pattern: patterns.dob1Pattern as Dob1Pattern })
                .find((t) => t.name === "IMAGE")?.traits[0]?.SVG;
            if (typeof svg !== "string") throw new Error("Decoder returned no SVG cover.");
            send({ type: "success", id: request.id, value: { dna: request.dna, traits, svg } });
        } else {
            const value = music.renderWav(request.options);
            send({ type: "success", id: request.id, value }, [value.data.buffer]);
        }
    } catch (error) {
        send({
            type: "error",
            id: request.id,
            message: error instanceof Error ? error.message : "Decoder operation failed.",
        });
    }
};
