import assert from "node:assert/strict";
import test from "node:test";
import {
    DEFAULT_START_HEIGHT,
    deploymentBlockProgress,
    SCAN_DEPLOYMENTS,
    needsScanReset,
    parseStartHeight,
    scanCursor,
} from "../src/app/chain/scan";

test("release default includes both deployed artifacts without a network request", () => {
    assert.equal(DEFAULT_START_HEIGHT, 22931557n);
    assert.ok(DEFAULT_START_HEIGHT <= SCAN_DEPLOYMENTS.cluster.height);
    assert.ok(DEFAULT_START_HEIGHT <= SCAN_DEPLOYMENTS.decoder.height);
    assert.equal(parseStartHeight(""), DEFAULT_START_HEIGHT);
    assert.equal(parseStartHeight("  "), DEFAULT_START_HEIGHT);
});
test("start heights retain u64 precision and reject invalid input", () => {
    assert.equal(parseStartHeight("0"), 0n);
    assert.equal(parseStartHeight(" 0123 "), 123n);
    assert.equal(parseStartHeight("18446744073709551615"), 0xffffffffffffffffn);
    for (const input of ["-1", "1.5", "1e6", "0xff", "NaN", "18446744073709551616"])
        assert.throws(() => parseStartHeight(input));
});
test("scan cursors include the creation block and handle genesis", () => {
    assert.equal(scanCursor(0n), 0n);
    assert.equal(scanCursor(1n), 0n);
    assert.equal(scanCursor(DEFAULT_START_HEIGHT), DEFAULT_START_HEIGHT - 1n);
});
test("persisted progress survives reconnects but earlier starts rewind", () => {
    assert.equal(needsScanReset(300n, "100", 100n), false);
    assert.equal(needsScanReset(300n, "100", 200n), false);
    assert.equal(needsScanReset(300n, "200", 100n), true);
    assert.equal(needsScanReset(99n, "100", 200n), true);
    assert.equal(needsScanReset(199n, "200", 200n), false);
    assert.equal(needsScanReset(300n, undefined, 100n), true);
    assert.equal(needsScanReset(300n, "corrupt", 100n), true);
    assert.equal(needsScanReset(300n, "100", 0n), true);
});

test("deployment progress clamps to the Cluster/decoder creation interval", () => {
    const low = DEFAULT_START_HEIGHT;
    const high = SCAN_DEPLOYMENTS.cluster.height;
    assert.equal(deploymentBlockProgress(0n), 0);
    assert.equal(deploymentBlockProgress(low - 1n), 0);
    assert.equal(deploymentBlockProgress(low), 0);
    const middle = low + (high - low) / 2n;
    assert.ok(deploymentBlockProgress(middle) > 49);
    assert.ok(deploymentBlockProgress(middle) < 51);
    assert.ok(deploymentBlockProgress(high - 1n) < 100);
    assert.equal(deploymentBlockProgress(high), 100);
    assert.equal(deploymentBlockProgress(high + 1n), 100);
    assert.equal(deploymentBlockProgress(0xffffffffffffffffn), 100);
});
