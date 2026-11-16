import assert from "node:assert/strict";
import test from "node:test";
import { errorMessage, friendlyError, isAbortError } from "../src/app/common/errors";

test("SDK string and Worker-event rejections preserve diagnostic messages", () => {
    const text =
        "Unable to parse network setting from toml: missing field `rpc` at line 4 column 1";
    assert.equal(errorMessage(text), text);
    assert.equal(errorMessage(new Error(text)), text);
    assert.equal(errorMessage({ message: text, type: "error" }), text);
    assert.equal(errorMessage({ error: new Error(text) }), text);
    const value = friendlyError(text);
    assert.match(value.title, /configuration/i);
    assert.match(value.action, /reload/i);
    assert.equal(value.details, text);
});
test("timeout recovery is not misclassified as storage failure", () => {
    const value = friendlyError(
        "Light client did not respond. Stop it and reconnect; check browser storage permissions if startup failed.",
    );
    assert.match(value.title, /connecting/i);
    assert.match(value.action, /reconnect/i);
});
test("browser security, locked tabs and synchronization have actionable explanations", () => {
    assert.match(
        friendlyError("SharedArrayBuffer requires cross-origin isolation").action,
        /HTTPS/,
    );
    assert.match(
        friendlyError("A light client is already running in another tab").action,
        /close that tab/i,
    );
    assert.match(
        friendlyError("Script synchronization is still in progress").action,
        /scan progress/i,
    );
    assert.match(
        friendlyError("Enter 1–32 WSS peer multiaddresses, one per line.").title,
        /peer addresses/i,
    );
});
test("empty/circular errors and cancellation do not cause a second error", () => {
    assert.ok(errorMessage(null));
    const value: { error?: unknown } = {};
    value.error = value;
    assert.ok(errorMessage(value));
    assert.equal(isAbortError(null), false);
    assert.equal(isAbortError("failure"), false);
    assert.equal(isAbortError(new DOMException("Cancelled", "AbortError")), true);
    assert.ok(friendlyError({ unexpected: true }).message);
});
