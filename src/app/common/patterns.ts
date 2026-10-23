import type { Dob0Pattern, Dob1Pattern, TraitValue } from "./types";

interface Patterns {
    dob0Pattern: Dob0Pattern;
    dob1Pattern: Dob1Pattern;
}

let patterns: Patterns | null = null;
let loading: Promise<void> | null = null;

function isValue(value: unknown): value is TraitValue {
    return typeof value === "string" || (typeof value === "number" && Number.isSafeInteger(value));
}

export function parsePatternDocument(document: string): Patterns {
    const arrays: unknown[] = [...document.matchAll(/```json[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```/g)]
        .map((match) => JSON.parse(match[1]) as unknown)
        .filter(Array.isArray);
    if (!document.includes("seedsong-pattern/1") || arrays.length !== 2) {
        throw new Error("The document must contain the Seedsong v1 DOB/0 and DOB/1 patterns.");
    }
    const [dob0, dob1] = arrays;
    if (
        !Array.isArray(dob0) ||
        !dob0.length ||
        !dob0.every((entry: unknown) => {
            if (!Array.isArray(entry) || entry.length !== 6) return false;
            const [name, type, offset, length, kind, args] = entry;
            if (
                typeof name !== "string" ||
                !name ||
                !["String", "Number"].includes(type) ||
                !Number.isInteger(offset) ||
                offset < 0 ||
                offset >= 32 ||
                length !== 1 ||
                !Array.isArray(args) ||
                !args.length ||
                !args.every(isValue)
            )
                return false;
            if (kind === "options")
                return args.every(
                    (value: TraitValue) =>
                        typeof value === (type === "String" ? "string" : "number"),
                );
            return (
                kind === "range" &&
                type === "Number" &&
                args.length === 2 &&
                args.every((value: TraitValue) => typeof value === "number") &&
                args[0] < args[1]
            );
        })
    )
        throw new Error("The document contains an unsupported DOB/0 pattern.");
    if (new Set(dob0.map((entry) => entry[0])).size !== dob0.length) {
        throw new Error("DOB/0 trait names must be unique.");
    }
    if (
        !Array.isArray(dob1) ||
        !dob1.length ||
        !dob1.every((entry: unknown) => {
            if (!Array.isArray(entry) || entry.length !== 5) return false;
            const [image, field, trait, kind, args] = entry;
            if (
                image !== "IMAGE.0" ||
                !["attributes", "elements"].includes(field) ||
                typeof trait !== "string"
            )
                return false;
            if (kind === "raw") return trait === "" && typeof args === "string";
            if (
                kind !== "options" ||
                !trait ||
                !dob0.some((item) => item[0] === trait) ||
                !Array.isArray(args)
            )
                return false;
            return (
                args.length > 0 &&
                args.every((branch: unknown) => {
                    if (
                        !Array.isArray(branch) ||
                        branch.length !== 2 ||
                        typeof branch[1] !== "string"
                    )
                        return false;
                    const condition = branch[0];
                    return (
                        typeof condition === "string" ||
                        (Array.isArray(condition) &&
                            condition.length === 2 &&
                            condition.every(
                                (value: unknown) =>
                                    typeof value === "number" && Number.isSafeInteger(value),
                            ) &&
                            condition[0] <= condition[1])
                    );
                })
            );
        })
    )
        throw new Error("The document contains an unsupported DOB/1 pattern.");
    return { dob0Pattern: dob0 as Dob0Pattern, dob1Pattern: dob1 as Dob1Pattern };
}

export function getPatterns(): Patterns {
    if (!patterns) throw new Error("The artwork patterns have not loaded yet.");
    return patterns;
}

export function loadPatterns(url: string): Promise<void> {
    if (!loading) {
        loading = fetch(url)
            .then(async (response) => {
                if (!response.ok)
                    throw new Error(
                        `Could not load the artwork patterns (HTTP ${response.status}).`,
                    );
                patterns = parsePatternDocument(await response.text());
            })
            .catch((error: unknown) => {
                loading = null;
                throw error;
            });
    }
    return loading;
}
