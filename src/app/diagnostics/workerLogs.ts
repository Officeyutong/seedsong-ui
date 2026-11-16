import { consoleText, logStore } from "./logs";
/** Prepended only to the pinned SDK's two inline Workers by our Vite plugin.
 * Keep normal console output and forward info/warn/error separately from RPC replies.
 */
export const lightClientLogPrelude = String.raw`(() => {
    const send = self.postMessage.bind(self);
    const snapshot = (args) => {
        let budget = 12000;
        return args.slice(0, 16).map((value) => {
            if (budget <= 0) return "[truncated]";
            let result;
            if (typeof value === "string") result = value.slice(0, Math.min(budget, 4000));
            else {
                try {
                    const seen = new WeakSet();
                    const json = JSON.stringify(value, (_, item) => {
                        if (typeof item === "bigint") return item.toString();
                        if (item instanceof Error) return { name: item.name, message: item.message };
                        if (item && typeof item === "object") {
                            if (seen.has(item)) return "[Circular]";
                            seen.add(item);
                        }
                        return item;
                    });
                    result = json === undefined ? String(value) : json.length > Math.min(budget, 4000)
                        ? json.slice(0, Math.min(budget, 4000)) + "…" : JSON.parse(json);
                } catch { result = String(value).slice(0, Math.min(budget, 4000)); }
            }
            budget -= typeof result === "string" ? result.length : JSON.stringify(result).length;
            return result;
        });
    };
    for (const method of ["log", "info", "warn", "error"]) {
        const original = console[method].bind(console);
        console[method] = (...args) => {
            original(...args);
            try { send({ __seedsongLightClientLog: true, level: method === "log" ? "info" : method,
                args: snapshot(args) }); } catch {}
        };
    }
})();
`;

/** Consume diagnostic messages before SDK startup/command handlers see them. */
export function attachLightClientWorker(worker: Worker): Worker {
    worker.addEventListener(
        "message",
        (event: MessageEvent<unknown>) => {
            if (!event.data || typeof event.data !== "object") return;
            const data = event.data as Record<string, unknown>;
            if (data.__seedsongLightClientLog !== true) return;
            event.stopImmediatePropagation();
            const args = Array.isArray(data.args) ? data.args.slice(0, 16) : undefined;
            const message = args ? consoleText(args) : data.message;
            if (typeof message !== "string") return;
            const level = data.level === "warn" || data.level === "error" ? data.level : "info";
            logStore.add("LC WASM", message, level, args);
        },
        { capture: true },
    );
    worker.addEventListener("error", (event) => {
        logStore.add(
            "LC Worker",
            event.message || "Worker failed without an error message.",
            "error",
        );
    });
    worker.addEventListener("messageerror", () => {
        logStore.add("LC Worker", "Could not deserialize a Worker response.", "error");
    });
    return worker;
}
