import { useEffect, useState, useSyncExternalStore } from "react";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
    Stack,
    Typography,
} from "@mui/material";
import { openLogPanel } from "../diagnostics/logs";
import { chainRuntime } from "../chain/runtime";

export default function MintOperationStatus({ step }: { step: string }) {
    const chain = useSyncExternalStore(chainRuntime.subscribe, chainRuntime.getSnapshot);
    const [startedAt] = useState(Date.now);
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <Dialog
            open
            fullWidth
            maxWidth="md"
            aria-labelledby="mint-operation-title"
            aria-describedby="mint-operation-step"
        >
            <DialogTitle id="mint-operation-title">Current step</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1.5}>
                    <Typography
                        id="mint-operation-step"
                        variant="body2"
                        aria-live="polite"
                        sx={{ overflowWrap: "anywhere" }}
                    >
                        {step}
                    </Typography>
                    <LinearProgress aria-label="Current mint operation" />
                    <Typography variant="caption" color="text.secondary">
                        Elapsed: {Math.max(0, Math.floor((now - startedAt) / 1000))}s · Light
                        client: {chain.phase} · Peers: {chain.peers}
                        {" · "}Verified tip: {chain.tip.toString()} · Target:{" "}
                        {chain.target.toString()}
                    </Typography>
                    {chain.phase === "starting" && (
                        <Typography variant="body2">{chain.message}</Typography>
                    )}
                    {!!chain.waits.length && (
                        <Typography variant="caption">
                            Active light-client requests (including background work)
                        </Typography>
                    )}
                    {chain.waits.map((wait) => (
                        <Box
                            key={wait.id}
                            sx={{ borderLeft: 2, borderColor: "primary.main", pl: 1.5 }}
                        >
                            <Typography variant="body2">
                                {wait.kind === "script"
                                    ? "Script synchronization"
                                    : "Transaction proof"}
                                : {wait.detail}
                            </Typography>
                            <Typography
                                variant="caption"
                                component="div"
                                sx={{ overflowWrap: "anywhere", fontFamily: "monospace" }}
                            >
                                {wait.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Waiting: {Math.max(0, Math.floor((now - wait.startedAt) / 1000))}s
                                {wait.cursor !== undefined && (
                                    <> · Scan height: {wait.cursor.toString()}</>
                                )}
                                {wait.target !== undefined && wait.target > 0n && (
                                    <>
                                        {" "}
                                        · Target: {wait.target.toString()}
                                        {wait.cursor !== undefined && (
                                            <>
                                                {" "}
                                                · Remaining blocks:{" "}
                                                {(wait.target > wait.cursor
                                                    ? wait.target - wait.cursor
                                                    : 0n
                                                ).toString()}
                                            </>
                                        )}
                                    </>
                                )}
                            </Typography>
                        </Box>
                    ))}
                    {!!chain.waits.length && (
                        <Typography variant="caption" color="text.secondary">
                            Historical scans can take several minutes. The deployment progress
                            reaching 100% does not mean wallet or authorization scripts have caught
                            up to the chain tip. Open Logs for more details.
                        </Typography>
                    )}
                    {chain.error && (
                        <Typography variant="body2" color="error">
                            {chain.error}
                        </Typography>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={openLogPanel}>View logs</Button>
            </DialogActions>
        </Dialog>
    );
}
