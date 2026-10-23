/// <reference lib="webworker" />
import { createSeedsong } from "seedsong-js";
import type { MusicRequest, MusicResponse } from "./types";
const scope = self as unknown as DedicatedWorkerGlobalScope;
const music = await createSeedsong();
function send(response: MusicResponse, transfer: Transferable[] = []) {
    scope.postMessage(response, transfer);
}
scope.onmessage = (event: MessageEvent<MusicRequest>) => {
    const request = event.data;
    try {
        if (request.type === "random") {
            send({ type: "success", id: request.id, value: music.randomDna() });
        } else {
            const value = music.renderWav(request.options);
            send({ type: "success", id: request.id, value }, [value.data.buffer]);
        }
    } catch (error) {
        console.error("Seedsong worker request failed", error);
        send({
            type: "error",
            id: request.id,
            message:
                request.type === "random"
                    ? "Could not generate random DNA. Please try again."
                    : "Could not render audio. Check your DNA and sound settings, then try again.",
        });
    }
};
send({ type: "ready" });
