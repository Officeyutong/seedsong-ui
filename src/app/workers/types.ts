import type { RenderOptions, RenderedWav } from "seedsong-js";
export type MusicRequest =
    { id: number; type: "random" } | { id: number; type: "render"; options: RenderOptions };
export type MusicResponse =
    | { type: "ready" }
    | { type: "success"; id: number; value: string | RenderedWav }
    | { type: "error"; id: number; message: string };
