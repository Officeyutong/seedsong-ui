import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    Container,
    CssBaseline,
    CircularProgress,
    Tab,
    Tabs,
    ThemeProvider,
    Typography,
} from "@mui/material";
import { AutoAwesomeOutlined, HelpOutlineRounded, AlbumOutlined } from "@mui/icons-material";
import { makeTheme } from "./theme";
import { setPatterns } from "./common/patterns";
import DecoderPanel from "./decoder/DecoderPanel";
import { DecoderEngine, closeSession, session } from "./decoder/engine";
import type { DecoderSession } from "./decoder/engine";
import { normalizeSettings, readSettings } from "./decoder/types";
import type { DecoderSettings } from "./decoder/types";
import BusyButton from "./common/BusyButton";
import Header from "./views/Header";
import CreateView from "./views/create/CreateView";
import HelpView from "./views/help/HelpView";
import { REFERENCE_DNA } from "./common/dna";
const MintView = lazy(() => import("./mint/MintView"));

export default function App() {
    const [dark, setDark] = useState(
        () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    const [tab, setTab] = useState(0);
    const [mintOpened, setMintOpened] = useState(false);
    const [mintDna, setMintDna] = useState(REFERENCE_DNA);
    const [mintBusy, setMintBusy] = useState(false);
    const [initial] = useState(readSettings);
    const [decoder, setDecoder] = useState<DecoderSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState("Loading decoder…");
    const [loadError, setLoadError] = useState("");
    const active = useRef<DecoderSession | null>(null);
    const pending = useRef<DecoderEngine | null>(null);
    const sequence = useRef(0);
    const theme = useMemo(() => makeTheme(dark ? "dark" : "light"), [dark]);
    const load = useCallback(async (input: DecoderSettings) => {
        const id = ++sequence.current;
        pending.current?.dispose();
        setLoading(true);
        setLoadError("");
        setProgress("Loading decoder…");
        let engine: DecoderEngine | null = null;
        try {
            const settings = normalizeSettings(input);
            engine = new DecoderEngine(settings, (message) => {
                if (sequence.current === id) setProgress(message);
            });
            pending.current = engine;
            const info = await engine.initialize();
            if (sequence.current !== id) {
                engine.dispose();
                return;
            }
            const next = session(engine, info);
            setPatterns(info.patterns);
            const previous = active.current;
            active.current = next;
            pending.current = null;
            setDecoder(next);
            if (previous) closeSession(previous);
            try {
                localStorage.setItem("seedsong.decoder", JSON.stringify(settings));
            } catch {
                /* Storage is optional. */
            }
        } catch (error) {
            engine?.dispose();
            if (sequence.current === id && (error as Error).name !== "AbortError")
                setLoadError(
                    error instanceof Error ? error.message : "Could not load the decoder.",
                );
        } finally {
            if (sequence.current === id) {
                pending.current = null;
                setLoading(false);
            }
        }
    }, []);
    const cancelLoading = useCallback(() => {
        sequence.current++;
        pending.current?.dispose();
        pending.current = null;
        setLoading(false);
        setProgress("");
    }, []);
    const disposeResources = useCallback(() => {
        sequence.current++;
        pending.current?.dispose();
        pending.current = null;
        if (active.current) {
            closeSession(active.current);
            active.current = null;
        }
    }, []);
    useEffect(() => {
        let mounted = true;
        void Promise.resolve().then(() => {
            if (mounted) return load(initial);
        });
        return () => {
            mounted = false;
            disposeResources();
        };
    }, [initial, load, disposeResources]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Header dark={dark} onToggleTheme={() => setDark(!dark)} />
            <Box sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
                <Container maxWidth="xl">
                    <Tabs
                        value={tab}
                        onChange={(_, value: number) => {
                            setTab(value);
                            if (value === 2) setMintOpened(true);
                        }}
                        aria-label="Main navigation"
                    >
                        <Tab
                            id="tab-create"
                            aria-controls="panel-create"
                            icon={<AutoAwesomeOutlined sx={{ fontSize: 18 }} />}
                            iconPosition="start"
                            label="Create"
                        />
                        <Tab
                            id="tab-help"
                            aria-controls="panel-help"
                            icon={<HelpOutlineRounded sx={{ fontSize: 18 }} />}
                            iconPosition="start"
                            label="Guide"
                        />
                        <Tab
                            id="tab-mint"
                            aria-controls="panel-mint"
                            icon={<AlbumOutlined sx={{ fontSize: 18 }} />}
                            iconPosition="start"
                            label="Mint"
                        />
                    </Tabs>
                </Container>
            </Box>
            <Container maxWidth="xl" inert={mintBusy}>
                <DecoderPanel
                    initial={initial}
                    active={decoder}
                    loading={loading}
                    progress={progress}
                    error={loadError}
                    onLoad={load}
                    onCancel={cancelLoading}
                />
            </Container>
            <Box component="main">
                <Box
                    role="tabpanel"
                    id="panel-create"
                    aria-labelledby="tab-create"
                    hidden={tab !== 0}
                >
                    {decoder !== null ? (
                        <CreateView
                            decoder={decoder}
                            mintBusy={mintBusy}
                            onMint={(dna) => {
                                if (!mintBusy) {
                                    setMintDna(dna);
                                    setMintOpened(true);
                                    setTab(2);
                                }
                            }}
                        />
                    ) : (
                        <Container maxWidth="sm" sx={{ py: 8, textAlign: "center" }}>
                            {loadError && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    {loadError}
                                </Alert>
                            )}
                            <BusyButton
                                variant="outlined"
                                busy={loading}
                                busyLabel={progress || "Loading decoder…"}
                                onClick={() => void load(initial)}
                            >
                                Retry loading decoder
                            </BusyButton>
                        </Container>
                    )}
                </Box>
                <Box role="tabpanel" id="panel-help" aria-labelledby="tab-help" hidden={tab !== 1}>
                    {tab === 1 && decoder && <HelpView decoder={decoder} />}
                </Box>
                <Box role="tabpanel" id="panel-mint" aria-labelledby="tab-mint" hidden={tab !== 2}>
                    {mintOpened && (
                        <Suspense
                            fallback={
                                <Box sx={{ p: 6, textAlign: "center" }}>
                                    <CircularProgress aria-label="Loading mint interface" />
                                </Box>
                            }
                        >
                            <MintView
                                dna={mintDna}
                                onDnaChange={setMintDna}
                                decoder={decoder}
                                sourceBusy={loading}
                                onBusy={setMintBusy}
                            />
                        </Suspense>
                    )}
                </Box>
            </Box>
            <Container maxWidth="xl">
                <Box
                    component="footer"
                    sx={{
                        borderTop: 1,
                        borderColor: "divider",
                        py: 3,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 2,
                        flexWrap: "wrap",
                    }}
                >
                    <Typography variant="caption" color="text.secondary">
                        seedsong. / Turn a seed into a song
                    </Typography>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontFamily: "var(--mono)" }}
                    >
                        MUSIC / 2 &nbsp;·&nbsp; PATTERN / 1
                    </Typography>
                </Box>
            </Container>
        </ThemeProvider>
    );
}
