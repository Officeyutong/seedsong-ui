import type { RenderOptions, RenderedWav } from "seedsong-js";
import type {
    CoverResult,
    DecoderInfo,
    DecoderPackage,
    DecoderSettings,
    DecoderArchive,
} from "../decoder/types";
export type MusicCommand =
    | { type: "init"; source: DecoderSettings | DecoderPackage | DecoderArchive }
    | { type: "random" }
    | { type: "cover"; dna: string }
    | { type: "render"; options: RenderOptions };
export type MusicRequest = MusicCommand & { id: number };
export type MusicValue = string | RenderedWav | CoverResult | DecoderInfo;
export type MusicResponse =
    | { type: "progress"; id: number; message: string }
    | { type: "success"; id: number; value: MusicValue }
    | { type: "error"; id: number; message: string };
