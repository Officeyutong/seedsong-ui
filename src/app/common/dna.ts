import { getPatterns } from "./patterns";
import type { Dob0Entry, TraitValue } from "./types";
export const REFERENCE_DNA = "9a401c07e8553fa2710c0000000000000209b62d000000000000000000000000";
export function parseDna(input: string): Uint8Array<ArrayBuffer> {
    const hex = input
        .trim()
        .replace(/^0x/i, "")
        .replace(/[\s_-]/g, "");
    if (!/^[0-9a-f]*$/i.test(hex))
        throw new Error("DNA can only contain hexadecimal characters 0–9 and a–f.");
    if (hex.length !== 64)
        throw new Error(`Expected 64 hexadecimal characters; received ${hex.length}.`);
    return Uint8Array.from(hex.match(/../g)!, (byte) => Number.parseInt(byte, 16));
}
export function formatDna(dna: Uint8Array): string {
    if (dna.length !== 32) throw new Error("DNA must contain exactly 32 bytes.");
    return Array.from(dna, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function decodeEntry(dna: Uint8Array, entry: Dob0Entry): TraitValue {
    const [, , offset, length, kind, args] = entry;
    if (length !== 1 || dna.length !== 32) throw new Error("Unsupported DNA or pattern.");
    const byte = dna[offset];
    if (kind === "options") return args[byte % args.length];
    const [lo, hi] = args as number[];
    return lo + (byte % (hi - lo));
}
function randomIndex(length: number): number {
    if (length < 1 || length > 256) throw new Error("Invalid random options.");
    const byte = new Uint8Array(1);
    const limit = 256 - (256 % length);
    do {
        crypto.getRandomValues(byte);
    } while (byte[0] >= limit);
    return byte[0] % length;
}
export function setTrait(
    dna: Uint8Array,
    name: string,
    value: TraitValue,
): Uint8Array<ArrayBuffer> {
    const entry = getPatterns().dob0Pattern.find((item) => item[0] === name);
    if (!entry) throw new Error(`Unknown trait: ${name}`);
    const next = Uint8Array.from(dna);
    if (decodeEntry(dna, entry) === value) return next;
    if (name === "Form") {
        const index = entry[5].findIndex((candidate) => candidate === value);
        if (index < 0) throw new Error("Invalid musical form.");
        return setBits(dna, 18, 3, 0, index);
    }
    const candidates = Array.from({ length: 256 }, (_, byte) => byte).filter((byte) => {
        next[entry[2]] = byte;
        return decodeEntry(next, entry) === value;
    });
    if (!candidates.length) throw new Error(`Invalid value for ${name}.`);
    next[entry[2]] = candidates[randomIndex(candidates.length)];
    return next;
}
export function setBits(
    dna: Uint8Array,
    offset: number,
    mask: number,
    shift: number,
    value: number,
): Uint8Array<ArrayBuffer> {
    const next = Uint8Array.from(dna);
    next[offset] = (next[offset] & ~mask) | ((value << shift) & mask);
    return next;
}
export const STEP_BYTES = [
    [0, 1, 17],
    [3, 4, 5],
    [2, 16, 18, 19],
    [10, 11, 12, 13, 14, 15],
    [6, 7, 8, 9, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
];
export function randomizeBytes(
    dna: Uint8Array,
    offsets: readonly number[],
): Uint8Array<ArrayBuffer> {
    const next = Uint8Array.from(dna);
    const random = crypto.getRandomValues(new Uint8Array(offsets.length));
    offsets.forEach((offset, index) => {
        next[offset] = random[index];
    });
    return next;
}

export function randomizeTrait(dna: Uint8Array, name: string): Uint8Array<ArrayBuffer> {
    const entry = getPatterns().dob0Pattern.find((item) => item[0] === name);
    if (!entry) throw new Error(`Unknown trait: ${name}`);
    if (name === "Form") return setBits(dna, 18, 3, 0, randomIndex(4));
    return randomizeBytes(dna, [entry[2]]);
}
