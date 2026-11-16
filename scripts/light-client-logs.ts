import type { Plugin } from "vite";

/** The SDK callback exposes progress events, not wasm_logger console output.
 * Instrument only its inline Worker factory, never window.Worker or other workers.
 * Fail loudly if an SDK upgrade changes the factory instead of silently losing logs.
 */
export function instrumentLightClientLogs(code: string): string {
    let blobs = 0;
    let workers = 0;
    const updated = code
        .replace(/new Blob\(\[([\w$]+)\],\{type:"text\/javascript"\}\)/g, (_, source: string) => {
            blobs++;
            return `new Blob([__ssLogPrelude,${source}],{type:"text/javascript"})`;
        })
        .replace(/new Worker\(([\w$]+)\)/g, (_, url: string) => {
            workers++;
            return `__ssAttachWorker(new Worker(${url}))`;
        });
    if (blobs !== 1 || workers !== 1)
        throw new Error(
            "CKB light-client inline Worker factory changed. Update the log bridge for this SDK version.",
        );
    return `import { lightClientLogPrelude as __ssLogPrelude, attachLightClientWorker as __ssAttachWorker } from "/src/app/diagnostics/workerLogs";\n${updated}`;
}
export function lightClientLogs(): Plugin {
    return {
        name: "seedsong-light-client-logs",
        enforce: "pre",
        transform(code, id) {
            if (
                !id
                    .split("?")[0]
                    .replaceAll("\\", "/")
                    .endsWith("/@nervosnetwork/ckb-light-client-js/dist/index.js")
            )
                return;
            return { code: instrumentLightClientLogs(code), map: null };
        },
    };
}
