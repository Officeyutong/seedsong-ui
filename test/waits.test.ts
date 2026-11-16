import assert from "node:assert/strict";
import test from "node:test";
import { createWaitTracker } from "../src/app/chain/waits";
import type { ChainWait } from "../src/app/chain/waits";

test("concurrent chain waits publish individual script heights and proof states", () => {
    let active: readonly ChainWait[] = [];
    const tracker = createWaitTracker((waits) => {
        active = waits;
    });
    const script = tracker.begin("script", "authorization lock");
    const proof = tracker.begin("transaction", "0x1234");
    assert.equal(active.length, 2);
    script.update({ detail: "Scanning history", cursor: 22932000n, target: 23000000n });
    proof.update({ detail: "Proof fetching" });
    assert.equal(active[0].cursor, 22932000n);
    assert.equal(active[1].detail, "Proof fetching");
    proof.finish();
    assert.equal(active.length, 1);
    assert.equal(active[0].label, "authorization lock");
    script.finish();
    assert.equal(active.length, 0);
});

test("finishing or stopping a wait prevents late updates from resurrecting stale steps", () => {
    let active: readonly ChainWait[] = [];
    const tracker = createWaitTracker((waits) => {
        active = waits;
    });
    const old = tracker.begin("script", "old request");
    tracker.clear();
    const next = tracker.begin("script", "new request");
    old.update({ detail: "late response" });
    old.finish();
    assert.equal(active.length, 1);
    assert.equal(active[0].label, "new request");
    next.finish();
    next.update({ detail: "too late" });
    assert.equal(active.length, 0);
});
