import type { RenderOptions, RenderedWav } from "seedsong-js";
import type { MusicCommand, MusicResponse, MusicValue } from "../workers/types";
import type { CoverResult, DecoderInfo, DecoderPackage, DecoderSettings } from "./types";
type Pending = {
    resolve: (value: MusicValue) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};
/** Owns one Worker; cancelled audio can restart from the already checked package. */
export class DecoderEngine {
    private worker: Worker | null = null;
    private pending = new Map<number, Pending>();
    private sequence = 0;
    private boot: Promise<DecoderInfo> | null = null;
    private info: DecoderInfo | null = null;
    private cached: DecoderPackage | null = null;
    private closed = false;
    readonly settings: DecoderSettings;
    private progress: (message: string) => void;
    constructor(settings: DecoderSettings, progress: (message: string) => void = () => {}) {
        this.settings = settings;
        this.progress = progress;
    }
    get ready() {
        return !!this.worker && !!this.info;
    }
    private send(command: MusicCommand): Promise<MusicValue> {
        const id = ++this.sequence;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(
                () =>
                    this.cancel(
                        new Error("The decoder operation timed out. Check the RPC or try again."),
                    ),
                120_000,
            );
            this.pending.set(id, { resolve, reject, timer });
            try {
                this.worker!.postMessage({ ...command, id });
            } catch (error) {
                this.pending.delete(id);
                clearTimeout(timer);
                reject(error);
            }
        });
    }
    initialize(): Promise<DecoderInfo> {
        if (this.closed)
            return Promise.reject(new DOMException("Decoder source was replaced", "AbortError"));
        if (this.ready) return Promise.resolve(this.info!);
        if (this.boot) return this.boot;
        const worker = new Worker(new URL("../workers/music.worker.ts", import.meta.url), {
            type: "module",
        });
        this.worker = worker;
        worker.onmessage = (event: MessageEvent<MusicResponse>) => {
            if (this.worker !== worker) return;
            const response = event.data;
            if (response.type === "progress") {
                this.progress(response.message);
                return;
            }
            const pending = this.pending.get(response.id);
            if (!pending) return;
            clearTimeout(pending.timer);
            this.pending.delete(response.id);
            if (response.type === "success") pending.resolve(response.value);
            else pending.reject(new Error(response.message));
        };
        const fail = (message: string) => {
            if (this.worker === worker) this.cancel(new Error(message));
        };
        worker.onerror = () =>
            fail(
                "The decoder Worker could not run. Check module and WebAssembly permissions, then retry.",
            );
        worker.onmessageerror = () => fail("Could not read a decoder Worker response.");
        const boot = this.send({ type: "init", source: this.cached ?? this.settings })
            .then((value) => {
                if (this.worker !== worker)
                    throw new DOMException("Decoder loading was cancelled", "AbortError");
                this.info = value as DecoderInfo;
                this.cached = this.info.package;
                return this.info;
            })
            .catch((error) => {
                if (this.worker === worker) this.cancel(error);
                throw error;
            })
            .finally(() => {
                if (this.boot === boot) this.boot = null;
            });
        this.boot = boot;
        return boot;
    }
    private async request(command: MusicCommand): Promise<MusicValue> {
        await this.initialize();
        if (this.closed || !this.ready)
            throw new DOMException("Decoder operation was cancelled", "AbortError");
        return this.send(command);
    }
    async randomDna() {
        return (await this.request({ type: "random" })) as string;
    }
    async renderWav(options: RenderOptions) {
        return (await this.request({ type: "render", options })) as RenderedWav;
    }
    async cover(dna: string) {
        return (await this.request({ type: "cover", dna })) as CoverResult;
    }
    cancel(error: Error = new DOMException("Rendering was cancelled", "AbortError")) {
        this.worker?.terminate();
        this.worker = null;
        this.info = null;
        this.boot = null;
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pending.clear();
    }
    dispose() {
        this.closed = true;
        this.cancel();
    }
}
export interface DecoderSession {
    id: string;
    engine: DecoderEngine;
    info: DecoderInfo;
    documentUrls: { pattern: string; music: string; legacy: string };
}
let sequence = 0;
export function session(engine: DecoderEngine, info: DecoderInfo): DecoderSession {
    const url = (text: string) =>
        URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    return {
        id: `decoder-${++sequence}`,
        engine,
        info,
        documentUrls: {
            pattern: url(info.package.documents.pattern),
            music: url(info.package.documents.music),
            legacy: url(info.package.documents.legacy),
        },
    };
}
export function closeSession(value: DecoderSession) {
    value.engine.dispose();
    Object.values(value.documentUrls).forEach((url) => URL.revokeObjectURL(url));
}
