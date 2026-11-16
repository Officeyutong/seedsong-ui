import { useState, useSyncExternalStore } from "react";
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Stack,
    TextField,
    Typography,
    Chip,
    LinearProgress,
    Button,
} from "@mui/material";
import { ExpandMoreRounded } from "@mui/icons-material";
import BusyButton from "../common/BusyButton";
import { normalizePeers, readPeers } from "./config";
import { chainRuntime } from "./runtime";
import ErrorNotice from "../common/ErrorNotice";
import { errorMessage, isAbortError } from "../common/errors";
import {
    DEFAULT_START_HEIGHT,
    deploymentBlockProgress,
    readStartHeightInput,
    SCAN_DEPLOYMENTS,
} from "./scan";
export default function LightClientPanel({ busy }: { busy: boolean }) {
    const state = useSyncExternalStore(chainRuntime.subscribe, chainRuntime.getSnapshot);
    const [peers, setPeers] = useState(() => readPeers().join("\n"));
    const [startHeight, setStartHeight] = useState(readStartHeightInput);
    const [operation, setOperation] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState("");
    async function run(name: string, task: () => Promise<unknown>) {
        setOperation(name);
        setError("");
        try {
            await task();
        } catch (error) {
            if (!isAbortError(error)) setError(errorMessage(error));
        } finally {
            setOperation("");
        }
    }
    const starting = state.phase === "starting";
    // A subscription cursor can start ahead of verified headers. Do not count that
    // as verified progress; when subscriptions exist, both must reach the range.
    const loadedHeight = state.scripts > 0 && state.synced < state.tip ? state.synced : state.tip;
    const progress = deploymentBlockProgress(loadedHeight);
    const progressLabel = `${progress.toFixed(2)}%`;
    const deploymentEnd =
        SCAN_DEPLOYMENTS.cluster.height > SCAN_DEPLOYMENTS.decoder.height
            ? SCAN_DEPLOYMENTS.cluster.height
            : SCAN_DEPLOYMENTS.decoder.height;
    return (
        <Accordion
            variant="outlined"
            sx={{ my: 3 }}
            expanded={expanded || !!(error || state.error)}
            onChange={(_, value) => setExpanded(value)}
        >
            <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        CKB light client
                    </Typography>
                    <Chip
                        size="small"
                        color={state.phase === "running" && state.peers ? "success" : "default"}
                        label={`${state.phase} · ${state.peers} peers`}
                    />
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                <Stack spacing={2}>
                    <Typography variant="body2">{state.message}</Typography>
                    <Typography variant="caption">
                        Verified tip: {state.tip.toString()} · Peer target:{" "}
                        {state.target.toString()} · Subscribed scripts: {state.scripts} · Scan
                        height: {state.synced.toString()} · Configured start:{" "}
                        {state.startHeight.toString()}
                    </Typography>
                    <Stack spacing={1}>
                        <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                            <Typography variant="body2">
                                Cluster &amp; decoder block progress
                            </Typography>
                            <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                                {progressLabel}
                            </Typography>
                        </Stack>
                        <LinearProgress
                            variant="determinate"
                            value={progress}
                            aria-label="Cluster and decoder block progress"
                            aria-valuetext={progressLabel}
                        />
                        <Typography variant="caption" color="text.secondary">
                            Loaded height: {loadedHeight.toString()} · Deployment range:{" "}
                            {DEFAULT_START_HEIGHT.toString()}–{deploymentEnd.toString()}. Wallet
                            synchronization and decoder loading may continue after 100%.
                        </Typography>
                    </Stack>
                    <TextField
                        label="Testnet WSS peers"
                        multiline
                        minRows={3}
                        maxRows={8}
                        value={peers}
                        disabled={busy || !!operation || starting || state.phase === "running"}
                        onChange={(event) => setPeers(event.target.value)}
                        helperText="Peer multiaddresses, one per line. Stop the client before changing peers."
                    />
                    <TextField
                        label="Scan start height (inclusive)"
                        value={startHeight}
                        placeholder={DEFAULT_START_HEIGHT.toString()}
                        onChange={(event) => setStartHeight(event.target.value)}
                        disabled={busy || !!operation || starting || state.phase === "running"}
                        slotProps={{ htmlInput: { inputMode: "numeric" } }}
                        helperText={`Blank uses the release default: ${DEFAULT_START_HEIGHT}. Cluster: ${SCAN_DEPLOYMENTS.cluster.height}; decoder: ${SCAN_DEPLOYMENTS.decoder.height}. Changes apply on connection.`}
                    />
                    <Button
                        size="small"
                        sx={{ alignSelf: "flex-start" }}
                        disabled={busy || !!operation || starting || state.phase === "running"}
                        onClick={() => setStartHeight("")}
                    >
                        Use release default
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                        Stop the client before changing its start height. Earlier wallet funding or
                        a custom decoder may require a lower height; use 0 for complete history.
                        Moving the start earlier rescans the missing history. Existing stored data
                        is retained.
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <BusyButton
                            variant="outlined"
                            disabled={busy || !!operation || state.phase === "running"}
                            busy={operation === "connect" || starting}
                            busyLabel="Starting light client…"
                            onClick={() =>
                                void run("connect", async () => {
                                    const list = normalizePeers(peers);
                                    chainRuntime.setStartHeight(startHeight);
                                    localStorage.setItem(
                                        "seedsong.light.peers",
                                        JSON.stringify(list),
                                    );
                                    await chainRuntime.start(list);
                                })
                            }
                        >
                            Connect to testnet
                        </BusyButton>
                        <BusyButton
                            disabled={busy || !!operation || state.phase !== "running"}
                            busy={operation === "stop"}
                            onClick={() => void run("stop", () => chainRuntime.stop())}
                        >
                            Stop light client
                        </BusyButton>
                    </Stack>
                    {(error || state.error) && (
                        <ErrorNotice
                            error={error || state.error}
                            context="Could not connect to CKB testnet"
                        />
                    )}
                    <Typography variant="body2" color="text.secondary">
                        Chain data is fetched and verified over P2P, with no public RPC or indexer
                        fallback. First-time wallet history scanning can take time; keep this tab
                        open. Stored chain data is reused on the next connection.
                    </Typography>
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}
