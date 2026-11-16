export interface ChainWait {
    id: number;
    kind: "script" | "transaction";
    label: string;
    detail: string;
    startedAt: number;
    cursor?: bigint;
    target?: bigint;
}
/** Track concurrent waits independently, including cleanup on errors/cancellation. */
export function createWaitTracker(publish: (waits: readonly ChainWait[]) => void) {
    const waits = new Map<number, ChainWait>();
    let sequence = 0;
    const notify = () => publish([...waits.values()]);
    return {
        begin(kind: ChainWait["kind"], label: string) {
            const id = ++sequence;
            waits.set(id, {
                id,
                kind,
                label,
                detail: "Starting the light client…",
                startedAt: Date.now(),
            });
            notify();
            return {
                update(value: Partial<Pick<ChainWait, "detail" | "cursor" | "target">>) {
                    const current = waits.get(id);
                    if (!current) return;
                    waits.set(id, { ...current, ...value });
                    notify();
                },
                finish() {
                    if (waits.delete(id)) notify();
                },
            };
        },
        clear() {
            waits.clear();
            notify();
        },
    };
}
export type WaitHandle = ReturnType<ReturnType<typeof createWaitTracker>["begin"]>;
