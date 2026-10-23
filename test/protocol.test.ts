import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
    decodeEntry,
    formatDna,
    parseDna,
    randomizeBytes,
    randomizeTrait,
    REFERENCE_DNA,
    setBits,
    setTrait,
    STEP_BYTES,
} from "../src/app/common/dna";
import { decodeTraits, renderSvg } from "../src/app/common/dob";
import { getPatterns, loadPatterns } from "../src/app/common/patterns";
const document = readFileSync(
    new URL("../vendor/seedsong-base/pattern.md", import.meta.url),
    "utf8",
);
await loadPatterns(`data:text/plain,${encodeURIComponent(document)}`);
const { dob0Pattern, dob1Pattern } = getPatterns();

test("runtime patterns match the pinned submodule document", () => {
    const source = readFileSync(
        new URL("../vendor/seedsong-base/pattern.md", import.meta.url),
        "utf8",
    );
    const patterns = [...source.matchAll(/```json\n([\s\S]*?)\n```/g)]
        .map((match) => JSON.parse(match[1]))
        .filter(Array.isArray);
    assert.deepEqual([dob0Pattern, dob1Pattern], patterns);
});
test("DNA normalization rejects invalid input without truncation", () => {
    assert.equal(
        formatDna(parseDna(`0x${REFERENCE_DNA.match(/../g)!.join(" _-\n")}`)),
        REFERENCE_DNA,
    );
    for (const invalid of ["", "ab".repeat(31), "ab".repeat(33), "gg".repeat(32), "é".repeat(64)])
        assert.throws(() => parseDna(invalid));
});
test("the reference DNA has the specified traits and exact SVG assembly", () => {
    const traits = decodeTraits(parseDna(REFERENCE_DNA));
    assert.deepEqual(Object.values(traits), [
        "Major Pentatonic",
        124,
        "Leapy",
        "Soft Sine",
        "Sine Sub",
        "Midnight",
        "Orb",
        "Grid",
        "None",
        "North",
        "None",
        "Harmony",
        "A",
        "AABB",
    ]);
    const svg = renderSvg(traits);
    assert.ok(
        svg.startsWith(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='512' height='512' color='#F4D35E'>",
        ),
    );
    assert.ok(svg.includes("<rect width='512' height='512' fill='#0B1026'/>"));
    assert.ok(svg.includes("M256 56L456 256"));
    assert.ok(
        svg.endsWith(
            "<circle cx='224' cy='224' r='32' fill='#FFFFFF' fill-opacity='.2'/></g></svg>",
        ),
    );
});
test("all byte values agree with the music specification", () => {
    for (let value = 0; value < 256; value++) {
        const traits = decodeTraits(new Uint8Array(32).fill(value));
        const m = value % 32;
        assert.equal(
            traits.Mode,
            m < 8
                ? "Major"
                : m < 16
                  ? "Minor"
                  : m < 20
                    ? "Dorian"
                    : m < 24
                      ? "Mixolydian"
                      : m < 28
                        ? "Major Pentatonic"
                        : m < 31
                          ? "Minor Pentatonic"
                          : "Lydian",
        );
        assert.equal(traits.Tempo, 60 + (value % 81));
        assert.equal(
            traits.Lead,
            m < 10
                ? "Soft Sine"
                : m < 17
                  ? "Warm Organ"
                  : m < 23
                    ? "E-Piano"
                    : m < 28
                      ? "Glass Bell"
                      : m < 31
                        ? "Music Box"
                        : "Crystal",
        );
        assert.equal(
            traits.Contour,
            ["Smooth", "Smooth", "Smooth", "Balanced", "Balanced", "Balanced", "Balanced", "Leapy"][
                value % 8
            ],
        );
        assert.equal(traits.Bass, ["Sine Sub", "Sine Sub", "Round FM", "Pluck Bass"][value % 4]);
        assert.equal(
            traits.Key,
            ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][value % 12],
        );
        assert.equal(traits.Form, ["AABA", "ABAB", "AABB", "ABAC"][value % 4]);
        assert.equal(traits.Role, ["Melody", "Bass", "Harmony", "Rhythm"][value % 4]);
    }
});
test("every selectable trait round trips and preserves unrelated bytes", () => {
    for (const entry of dob0Pattern) {
        const choices =
            entry[4] === "options"
                ? [...new Set(entry[5])]
                : Array.from({ length: 81 }, (_, i) => i + 60);
        for (const value of choices) {
            const before = parseDna(REFERENCE_DNA);
            const after = setTrait(before, entry[0], value);
            assert.equal(decodeEntry(after, entry), value);
            for (let i = 0; i < 32; i++) if (i !== entry[2]) assert.equal(after[i], before[i]);
            assert.equal(formatDna(before), REFERENCE_DNA);
            assert.deepEqual(setTrait(after, entry[0], value), after);
        }
    }
});
test("bitfield edits preserve every other bit across all original bytes", () => {
    for (const [offset, mask, shift, size] of [
        [2, 7, 0, 8],
        [18, 3, 0, 4],
        [18, 12, 2, 4],
        [18, 48, 4, 4],
        [18, 192, 6, 4],
        [19, 3, 0, 4],
        [19, 12, 2, 4],
    ]) {
        for (let original = 0; original < 256; original++)
            for (let value = 0; value < size; value++) {
                const before = new Uint8Array(32).fill(original);
                const after = setBits(before, offset, mask, shift, value);
                assert.equal(after[offset] & ~mask, original & ~mask);
                assert.equal((after[offset] & mask) >> shift, value);
                for (let i = 0; i < 32; i++) if (i !== offset) assert.equal(after[i], before[i]);
            }
    }
});
test("step and seed randomization preserve unrelated bytes", () => {
    for (const offsets of STEP_BYTES) {
        const before = parseDna(REFERENCE_DNA);
        const after = randomizeBytes(before, offsets);
        for (let i = 0; i < 32; i++) if (!offsets.includes(i)) assert.equal(after[i], before[i]);
    }
});
test("DOB/1 tempo boundaries are inclusive and missing traits fail", () => {
    const traits = decodeTraits(parseDna(REFERENCE_DNA));
    for (const bpm of [60, 79, 80, 109, 110, 140]) {
        const svg = renderSvg({ ...traits, Tempo: bpm });
        assert.equal(svg.includes("r='184'"), bpm < 80);
        assert.equal(svg.includes("r='174'"), bpm >= 80 && bpm <= 109);
        assert.equal(svg.includes("M256 56L456"), bpm >= 110);
    }
    assert.throws(() => renderSvg({ ...traits, Tempo: 141 }));
    const { Shape: _, ...incomplete } = traits;
    assert.throws(() => renderSvg(incomplete));
});

test("Form selection and randomization preserve the upper arrangement bits", () => {
    for (let value = 0; value < 256; value++) {
        const dna = new Uint8Array(32).fill(value);
        for (const form of ["AABA", "ABAB", "AABB", "ABAC"])
            assert.equal(setTrait(dna, "Form", form)[18] & 252, value & 252);
        assert.equal(randomizeTrait(dna, "Form")[18] & 252, value & 252);
    }
});
