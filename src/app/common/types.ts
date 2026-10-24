export type TraitValue = string | number;
export type Dob0Entry = [
    string,
    "String" | "Number",
    number,
    number,
    "options" | "range",
    TraitValue[],
];
export type Dob0Pattern = Dob0Entry[];
export type Dob1Entry = [
    string,
    "attributes" | "elements",
    string,
    "raw" | "options",
    string | [string | [number, number], string][],
];
export type Dob1Pattern = Dob1Entry[];
export type Traits = Record<string, TraitValue>;
export interface RenderSettings {
    musicVersion: 1 | 2;
    timbre: "spec" | "piano";
    sampleRate: number;
    reverb: number;
    loop: boolean;
}
export interface RenderSnapshot {
    dna: string;
    settings: RenderSettings;
}
