import { getPatterns } from "./patterns";
import { decodeEntry } from "./dna";
import type { Traits } from "./types";
export function decodeTraits(dna: Uint8Array): Traits {
    if (dna.length !== 32) throw new Error("DNA must contain exactly 32 bytes.");
    return Object.fromEntries(
        getPatterns().dob0Pattern.map((entry) => [entry[0], decodeEntry(dna, entry)]),
    );
}
export function renderSvg(traits: Traits): string {
    const attributes: string[] = [];
    const elements: string[] = [];
    for (const [image, field, trait, kind, args] of getPatterns().dob1Pattern) {
        if (image !== "IMAGE.0") throw new Error("Unsupported image pattern.");
        let fragment: string;
        if (kind === "raw") {
            if (trait || typeof args !== "string") throw new Error("Invalid raw SVG pattern.");
            fragment = args;
        } else {
            if (typeof args === "string" || !(trait in traits))
                throw new Error(`Missing artwork trait: ${trait}`);
            const branch = args.find(([condition]) =>
                Array.isArray(condition)
                    ? typeof traits[trait] === "number" &&
                      condition[0] <= traits[trait] &&
                      traits[trait] <= condition[1]
                    : condition === traits[trait],
            );
            if (!branch) throw new Error(`No artwork branch matches ${trait}.`);
            fragment = branch[1];
        }
        (field === "attributes" ? attributes : elements).push(fragment);
    }
    return `<svg${attributes.map((value) => ` ${value}`).join("")}>${elements.join("")}</svg>`;
}
