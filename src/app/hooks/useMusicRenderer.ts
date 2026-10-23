import { useCallback, useEffect, useRef, useState } from "react";
import type { RenderOptions, RenderedWav } from "seedsong-js";
import type { MusicRequest, MusicResponse } from "../workers/types";
type Pending = { resolve: (value: string | RenderedWav) => void; reject: (error: Error) => void };
export function useMusicRenderer() {
    const workerRef = useRef<Worker | null>(null);
    const sequence = useRef(0);
    const pending = useRef(new Map<number, Pending>());
    const [engine, setEngine] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const dispose = useCallback((error: Error) => {
        workerRef.current?.terminate();
        workerRef.current = null;
        pending.current.forEach((request) => request.reject(error));
        pending.current.clear();
    }, []);
    useEffect(
        () => () => dispose(new DOMException("The page was closed", "AbortError")),
        [dispose],
    );
    const request = useCallback(
        (
            command: { type: "random" } | { type: "render"; options: RenderOptions },
        ): Promise<string | RenderedWav> => {
            if (!workerRef.current) {
                setEngine("loading");
                const worker = new Worker(new URL("../workers/music.worker.ts", import.meta.url), {
                    type: "module",
                });
                workerRef.current = worker;
                worker.onmessage = (event: MessageEvent<MusicResponse>) => {
                    const response = event.data;
                    if (response.type === "ready") {
                        setEngine("ready");
                        return;
                    }
                    const task = pending.current.get(response.id);
                    if (!task) return;
                    pending.current.delete(response.id);
                    if (response.type === "success") task.resolve(response.value);
                    else task.reject(new Error(response.message));
                };
                const fail = () => {
                    setEngine("error");
                    dispose(new Error("The music engine could not load. Please try again."));
                };
                worker.onerror = fail;
                worker.onmessageerror = fail;
            }
            const id = ++sequence.current;
            return new Promise((resolve, reject) => {
                pending.current.set(id, { resolve, reject });
                try {
                    workerRef.current!.postMessage({ ...command, id } satisfies MusicRequest);
                } catch (error) {
                    pending.current.delete(id);
                    reject(error);
                }
            });
        },
        [dispose],
    );
    const cancel = useCallback(() => {
        dispose(new DOMException("Rendering was cancelled", "AbortError"));
        setEngine("idle");
    }, [dispose]);
    return {
        engine,
        cancel,
        randomDna: useCallback(
            async () => (await request({ type: "random" })) as string,
            [request],
        ),
        renderWav: useCallback(
            async (options: RenderOptions) =>
                (await request({ type: "render", options })) as RenderedWav,
            [request],
        ),
    };
}
