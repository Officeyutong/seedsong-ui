import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
    consoleData,
    consoleText,
    createLogStore,
    formatLogs,
    logStore,
} from "../src/app/diagnostics/logs";
import { attachLightClientWorker, lightClientLogPrelude } from "../src/app/diagnostics/workerLogs";
import { instrumentLightClientLogs } from "../scripts/light-client-logs";

test("session logs retain only the most recent entries and bound individual messages", () => {
    const store = createLogStore(2);
    try {
        store.add("LC", "one");
        store.add("Mint", "two", "warn");
        store.add("LC WASM", "x".repeat(5000), "error");
        const entries = store.getSnapshot();
        assert.equal(entries.length, 2);
        assert.equal(entries[0].message, "two");
        assert.equal(entries[1].message.length, 4000);
        assert.match(formatLogs(entries), /WARN \[Mint\] two/);
        assert.match(formatLogs(entries), /ERROR \[LC WASM\]/);
        store.clear();
        assert.equal(store.getSnapshot().length, 0);
    } finally {
        store.clear();
    }
});

test("Worker console logs preserve console output and forward only info and above", () => {
    const sent: unknown[] = [];
    const consoleCalls: unknown[][] = [];
    const console = Object.fromEntries(
        ["log", "info", "warn", "error", "debug"].map((method) => [
            method,
            (...args: unknown[]) => consoleCalls.push(args),
        ]),
    );
    runInNewContext(
        lightClientLogPrelude +
            `
        console.info("ready", { height: 123n });
        console.warn("no peers");
        console.debug("too verbose");
    `,
        { self: { postMessage: (value: unknown) => sent.push(value) }, console },
    );
    assert.equal(consoleCalls.length, 3);
    assert.equal(sent.length, 2);
    const first = sent[0] as { __seedsongLightClientLog: boolean; level: string; args: unknown[] };
    assert.equal(first.__seedsongLightClientLog, true);
    assert.equal(first.level, "info");
    assert.equal(first.args[0], "ready");
    assert.match(JSON.stringify(first.args[1]), /123/);
});

test("Worker log messages cannot satisfy SDK startup or command response handlers", () => {
    const worker = new EventTarget();
    attachLightClientWorker(worker as unknown as Worker);
    const responses: unknown[] = [];
    worker.addEventListener("message", (event) => responses.push((event as MessageEvent).data));
    try {
        worker.dispatchEvent(
            new MessageEvent("message", {
                data: {
                    __seedsongLightClientLog: true,
                    level: "info",
                    message: "network started",
                },
            }),
        );
        assert.equal(responses.length, 0);
        assert.equal(logStore.getSnapshot().at(-1)?.message, "network started");
        worker.dispatchEvent(new MessageEvent("message", { data: {} }));
        worker.dispatchEvent(new MessageEvent("message", { data: { ok: true, data: "result" } }));
        worker.dispatchEvent(new MessageEvent("message", { data: { ok: false, error: "failed" } }));
        assert.deepEqual(responses, [
            {},
            { ok: true, data: "result" },
            { ok: false, error: "failed" },
        ]);
    } finally {
        logStore.clear();
    }
});

test("SDK instrumentation fails explicitly if the inline Worker factory changes", () => {
    const factory =
        'function make(source){let blob=new Blob([source],{type:"text/javascript"}),url=URL.createObjectURL(blob),worker=new Worker(url);return worker}';
    const instrumented = instrumentLightClientLogs(factory);
    assert.match(instrumented, /new Blob\(\[__ssLogPrelude,source\]/);
    assert.match(instrumented, /__ssAttachWorker\(new Worker\(url\)\)/);
    assert.throws(
        () => instrumentLightClientLogs("export class LightClient {}"),
        /factory changed/,
    );
    assert.throws(() => instrumentLightClientLogs(factory + factory), /factory changed/);
});

test("CSS console arguments remain structured for rendering and stay out of text exports", () => {
    const args = [
        "%cINFO%c Loading peer store",
        "color: white; background: green",
        "color: inherit",
    ];
    assert.equal(consoleText(args), "INFO Loading peer store");
    const store = createLogStore();
    try {
        store.add("LC WASM", consoleText(args), "info", args);
        const entry = store.getSnapshot()[0];
        const data = consoleData(entry);
        assert.equal(data[0], "[LC WASM] %cINFO%c Loading peer store");
        assert.equal(data[1], args[1]);
        assert.equal(data[2], args[2]);
        assert.doesNotMatch(formatLogs([entry]), /background: green|%c/);
    } finally {
        store.clear();
    }
});

test("Worker forwarding retains CSS arguments and inspectable object snapshots", () => {
    const sent: unknown[] = [];
    const console = Object.fromEntries(
        ["log", "info", "warn", "error"].map((name) => [name, () => {}]),
    );
    runInNewContext(
        lightClientLogPrelude +
            `
        const value = { height: 123n }; value.self = value;
        console.info("%cINFO%c Ready", "color: green", "", value);
    `,
        { self: { postMessage: (value: unknown) => sent.push(value) }, console },
    );
    const payload = sent[0] as { args: unknown[] };
    assert.equal(payload.args[0], "%cINFO%c Ready");
    assert.equal(payload.args[1], "color: green");
    assert.match(JSON.stringify(payload.args[3]), /Circular/);
    const worker = new EventTarget();
    attachLightClientWorker(worker as unknown as Worker);
    try {
        worker.dispatchEvent(new MessageEvent("message", { data: sent[0] }));
        assert.equal(logStore.getSnapshot().at(-1)?.data?.[1], "color: green");
        assert.doesNotMatch(logStore.getSnapshot().at(-1)!.message, /%c|color: green/);
    } finally {
        logStore.clear();
    }
});
