import { useCallback, useState } from "react";
import type { RenderOptions } from "seedsong-js";
import type { DecoderSession } from "../decoder/engine";
export function useMusicRenderer(decoder: DecoderSession) {
    const [epoch, setEpoch] = useState(0);
    const [engine, setEngine] = useState<"idle" | "loading" | "ready" | "error">("ready");
    const ready = useCallback(async () => {
        if (!decoder.engine.ready) setEngine("loading");
        try {
            await decoder.engine.initialize();
            setEngine("ready");
        } catch (error) {
            setEngine((error as Error).name === "AbortError" ? "idle" : "error");
            throw error;
        }
    }, [decoder]);
    const cancel = useCallback(() => {
        decoder.engine.cancel();
        setEngine("idle");
        setEpoch((v) => v + 1);
    }, [decoder]);
    return {
        engine,
        epoch,
        cancel,
        randomDna: useCallback(async () => {
            await ready();
            return decoder.engine.randomDna();
        }, [decoder, ready]),
        renderWav: useCallback(
            async (options: RenderOptions) => {
                await ready();
                return decoder.engine.renderWav(options);
            },
            [decoder, ready],
        ),
        cover: useCallback(
            async (dna: string) => {
                await ready();
                return decoder.engine.cover(dna);
            },
            [decoder, ready],
        ),
    };
}
