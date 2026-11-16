import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
    Box,
    Button,
    Chip,
    Drawer,
    Fab,
    FormControlLabel,
    IconButton,
    Stack,
    Switch,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";
import { CloseRounded, TerminalRounded } from "@mui/icons-material";
import BusyButton from "../common/BusyButton";
import { download, nextPaint } from "../common/download";
import { errorMessage } from "../common/errors";
import { Console } from "console-feed";
import { consoleData, formatLogs, logStore, logError, OPEN_LOG_PANEL_EVENT } from "./logs";

export default function LogPanel() {
    const theme = useTheme();
    const entries = useSyncExternalStore(logStore.subscribe, logStore.getSnapshot);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const show = () => setOpen(true);
        window.addEventListener(OPEN_LOG_PANEL_EVENT, show);
        return () => window.removeEventListener(OPEN_LOG_PANEL_EVENT, show);
    }, []);
    const [follow, setFollow] = useState(true);
    const [query, setQuery] = useState("");
    const [exporting, setExporting] = useState(false);
    const viewport = useRef<HTMLDivElement>(null);
    const filtered = entries.filter((entry) =>
        `${entry.level} ${entry.source} ${entry.message}`
            .toLowerCase()
            .includes(query.toLowerCase()),
    );
    useEffect(() => {
        if (open && follow && viewport.current)
            viewport.current.scrollTop = viewport.current.scrollHeight;
    }, [entries, open, follow, query]);
    return (
        <>
            <Fab
                variant="extended"
                size="medium"
                color="primary"
                sx={{
                    position: "fixed",
                    bottom: 20,
                    right: 20,
                    zIndex: (theme) => theme.zIndex.drawer - 1,
                }}
                onClick={() => setOpen(true)}
                aria-label="Open global light client logs"
            >
                <TerminalRounded sx={{ mr: 1 }} /> Logs ({entries.length})
            </Fab>
            <Drawer
                anchor="bottom"
                open={open}
                // Raise the whole modal (including its backdrop) above operation dialogs.
                sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
                onClose={() => setOpen(false)}
                slotProps={{ paper: { sx: { height: "min(60vh, 560px)", p: 2 } } }}
            >
                <Stack spacing={1.5} sx={{ minHeight: 0, height: "100%" }}>
                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                            Light client &amp; activity logs
                        </Typography>
                        <Chip label="Info and above" size="small" />
                        <IconButton aria-label="Close logs" onClick={() => setOpen(false)}>
                            <CloseRounded />
                        </IconButton>
                    </Stack>
                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
                    >
                        <TextField
                            size="small"
                            label="Filter logs"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                        <FormControlLabel
                            label="Follow logs"
                            control={
                                <Switch
                                    checked={follow}
                                    onChange={(_, checked) => setFollow(checked)}
                                />
                            }
                        />
                        <Button size="small" onClick={() => logStore.clear()}>
                            Clear
                        </Button>
                        <BusyButton
                            size="small"
                            busy={exporting}
                            disabled={!entries.length || exporting}
                            onClick={() => {
                                void (async () => {
                                    setExporting(true);
                                    try {
                                        const text = formatLogs(entries);
                                        await nextPaint();
                                        download(
                                            text,
                                            "text/plain;charset=utf-8",
                                            "seedsong-logs.txt",
                                        );
                                    } catch (error) {
                                        logError(
                                            "Logs",
                                            `Could not export logs: ${errorMessage(error)}`,
                                        );
                                    } finally {
                                        setExporting(false);
                                    }
                                })();
                            }}
                        >
                            Export logs
                        </BusyButton>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        Latest 1,000 entries, kept for this page session. Includes WASM Worker logs,
                        synchronization events and application steps.
                    </Typography>
                    <Box
                        ref={viewport}
                        role="region"
                        aria-label="Diagnostic log entries"
                        tabIndex={0}
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            overflow: "auto",
                            bgcolor: "action.hover",
                            p: 1.5,
                            borderRadius: 1,
                        }}
                    >
                        {!filtered.length && (
                            <Typography variant="body2">No matching logs yet.</Typography>
                        )}
                        <Console
                            variant={theme.palette.mode}
                            logGrouping={false}
                            logs={filtered.map((entry) => ({
                                id: String(entry.id),
                                method: entry.level,
                                data: consoleData(entry),
                                timestamp: entry.time,
                            }))}
                        />
                    </Box>
                </Stack>
            </Drawer>
        </>
    );
}
