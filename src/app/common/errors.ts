export interface FriendlyError {
    title: string;
    message: string;
    action: string;
    details: string;
}
/** SDKs may reject with strings or Worker events rather than Error instances. */
export function errorMessage(error: unknown): string {
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message || error.name;
    if (error && typeof error === "object") {
        const value = error as { message?: unknown; error?: unknown; reason?: unknown };
        if (typeof value.message === "string" && value.message) return value.message;
        if (value.error !== undefined && value.error !== error) return errorMessage(value.error);
        if (value.reason !== undefined && value.reason !== error) return errorMessage(value.reason);
        try {
            return JSON.stringify(error) || "Unknown error";
        } catch {
            /* Fall through. */
        }
    }
    return "No additional error information was provided.";
}
export function isAbortError(error: unknown): boolean {
    return !!error && typeof error === "object" && "name" in error && error.name === "AbortError";
}
export function friendlyError(
    error: unknown,
    context = "The operation could not be completed",
): FriendlyError {
    const details = errorMessage(error).slice(0, 6000);
    const text = details.toLowerCase();
    let title = context;
    let message = "Seedsong could not complete this request.";
    let action =
        "Try again. If the issue continues, share the technical details below when reporting it.";
    if (/parse network setting|missing field|invalid.*toml|unknown field/.test(text)) {
        title = "Light client configuration needs an update";
        message = "The network settings could not be loaded by this light-client version.";
        action =
            "Reload the updated page and connect again. If this continues, report the technical details below.";
    } else if (/cross.origin|sharedarraybuffer|coop:|coep:/.test(text)) {
        title = "The browser cannot start the light client";
        message = "This page is missing the security settings required for the light client.";
        action =
            "Open the site using HTTPS or localhost and reload. If this continues, contact the site administrator.";
    } else if (/wss peer multiaddresses/.test(text)) {
        title = "Check your peer addresses";
        message = "The peer list contains an unsupported address or is empty.";
        action =
            "Enter secure WebSocket (WSS) peer multiaddresses, one per line, then connect again.";
    } else if (/another tab|database.*lock|lock.*database/.test(text)) {
        title = "Light client is open in another tab";
        message = "Only one Seedsong tab can use the local chain database at a time.";
        action =
            "Stop the light client in the other tab, or close that tab, then connect again here.";
    } else if (
        /quota|storage|indexeddb|opfs|permission.*denied|securityerror/.test(text) &&
        !/did not respond|timed out|timeout/.test(text)
    ) {
        title = "Browser storage is unavailable";
        message = "Seedsong could not access the storage needed by the light client.";
        action =
            "Allow this site's storage, check available disk space, then reload. Do not clear saved mint receipts without exporting them first.";
    } else if (/atomics|web locks|webassembly|wasm.*support/.test(text)) {
        title = "Your browser needs an update";
        message = "A browser feature required by the light client is unavailable.";
        action = "Use a current browser on HTTPS or localhost, then try again.";
    } else if (/synchroniz|proof.*not available|proof.*unavailable|not yet verified/.test(text)) {
        title = "Chain data is still synchronizing";
        message = "The light client has not verified all the data needed for this request yet.";
        action =
            "Keep this tab open, check peer connections and scan progress in Settings, then retry when synchronization catches up.";
    } else if (
        /did not respond|timed out|timeout|websocket|failed to fetch|networkerror|network error/.test(
            text,
        )
    ) {
        title = "The light client could not finish connecting";
        message = "The connection or a background task did not respond in time.";
        action =
            "Check your connection and peer settings, then stop and reconnect the light client. Saved chain data will be reused.";
    } else if (/insufficient ckb|not enough capacity|fund the wallet|funding cell/.test(text)) {
        title = "Not enough available CKB";
        message = "The wallet does not have enough synchronized funding Cells for this mint.";
        action =
            "Fund the wallet or reduce the batch size. Wait for confirmation and synchronization before preparing again.";
    } else if (/authorization cells.*busy|another mint used/.test(text)) {
        title = "Another mint is using this authorization Cell";
        message = "A shared mint authorization Cell is temporarily unavailable.";
        action =
            "Wait for pending mints to confirm, then prepare a fresh transaction. Check any saved receipt before submitting a replacement.";
    } else if (/rejected.*user|user.*reject|user.*denied/.test(text)) {
        title = "Wallet request was declined";
        message = "The wallet did not approve this request.";
        action = "Retry when you are ready and review the request in your wallet.";
    }
    return { title, message, action, details };
}
