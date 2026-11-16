export type LogLevel = "info" | "warn" | "error";
export interface LogEntry {
    id: number;
    time: string;
    level: LogLevel;
    source: string;
    message: string;
    data?: unknown[];
}
/** Bounded, session-only diagnostics shared across tabs. Never persist wallet secrets. */
export function createLogStore(limit = 1000) {
    let entries: readonly LogEntry[] = [];
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const listeners = new Set<() => void>();
    const notify = () => {
        timer = undefined;
        listeners.forEach((listener) => listener());
    };
    return {
        getSnapshot: () => entries,
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        add(source: string, message: string, level: LogLevel = "info", data?: unknown[]) {
            entries = [
                ...entries.slice(Math.max(0, entries.length - limit + 1)),
                {
                    id: ++sequence,
                    time: new Date().toISOString(),
                    level,
                    source: source.slice(0, 100),
                    message: message.slice(0, 4000),
                    data: data?.slice(0, 16),
                },
            ];
            // Worker logs can arrive in bursts; update the UI at most five times/second.
            timer ??= setTimeout(notify, 200);
        },
        clear() {
            clearTimeout(timer);
            entries = [];
            notify();
        },
    };
}
export const logStore = createLogStore();
export const logInfo = (source: string, message: string) => logStore.add(source, message);
export const logWarn = (source: string, message: string) => logStore.add(source, message, "warn");
export const logError = (source: string, message: string) => logStore.add(source, message, "error");
export function formatLogs(entries: readonly LogEntry[]): string {
    return entries
        .map(
            (entry) =>
                `${entry.time} ${entry.level.toUpperCase()} [${entry.source}] ${entry.message}`,
        )
        .join("\n");
}

/** Readable filter/export text; keep original arguments separately for console-feed. */
export function consoleText(args: unknown[]): string {
    const text = (value: unknown): string => {
        if (typeof value === "string") return value;
        try {
            return (
                JSON.stringify(value, (_, item) =>
                    typeof item === "bigint" ? item.toString() : item,
                ) ?? String(value)
            );
        } catch {
            return String(value);
        }
    };
    if (typeof args[0] !== "string") return args.map(text).join(" ");
    let index = 1;
    const message = args[0].replace(/%([%csdifjoO])/g, (token, kind: string) => {
        if (kind === "%") return "%";
        if (index >= args.length) return token;
        const value = args[index++];
        return kind === "c" ? "" : text(value);
    });
    return [message, ...args.slice(index).map(text)].join(" ");
}

/** Prefix metadata without splitting console format tokens from their arguments. */
export function consoleData(entry: LogEntry): unknown[] {
    const data = entry.data?.length ? entry.data : [entry.message];
    const prefix = `[${entry.source}] `;
    return typeof data[0] === "string" ? [prefix + data[0], ...data.slice(1)] : [prefix, ...data];
}

export const OPEN_LOG_PANEL_EVENT = "seedsong:open-log-panel";
export function openLogPanel(): void {
    window.dispatchEvent(new Event(OPEN_LOG_PANEL_EVENT));
}
