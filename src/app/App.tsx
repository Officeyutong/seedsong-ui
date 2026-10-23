import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Container,
    CssBaseline,
    Tab,
    Tabs,
    ThemeProvider,
    Typography,
} from "@mui/material";
import { AutoAwesomeOutlined, HelpOutlineRounded } from "@mui/icons-material";
import { makeTheme } from "./theme";
import { loadPatterns } from "./common/patterns";
import { patternUrl } from "./common/specifications";
import BusyButton from "./common/BusyButton";
import Header from "./views/Header";
import CreateView from "./views/create/CreateView";
import HelpView from "./views/help/HelpView";

export default function App() {
    const [dark, setDark] = useState(
        () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    const [tab, setTab] = useState(0);
    const [patternState, setPatternState] = useState<"loading" | "ready" | "error">("loading");
    const [patternError, setPatternError] = useState("");
    const theme = useMemo(() => makeTheme(dark ? "dark" : "light"), [dark]);
    const retryPatterns = useCallback(async () => {
        setPatternState("loading");
        setPatternError("");
        try {
            await loadPatterns(patternUrl);
            setPatternState("ready");
        } catch (error) {
            setPatternError(
                error instanceof Error ? error.message : "Could not load the artwork patterns.",
            );
            setPatternState("error");
        }
    }, []);
    useEffect(() => {
        let active = true;
        loadPatterns(patternUrl).then(
            () => {
                if (active) setPatternState("ready");
            },
            (error: unknown) => {
                if (active) {
                    setPatternError(
                        error instanceof Error
                            ? error.message
                            : "Could not load the artwork patterns.",
                    );
                    setPatternState("error");
                }
            },
        );
        return () => {
            active = false;
        };
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Header dark={dark} onToggleTheme={() => setDark(!dark)} />
            <Box sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
                <Container maxWidth="xl">
                    <Tabs
                        value={tab}
                        onChange={(_, value: number) => setTab(value)}
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
                    </Tabs>
                </Container>
            </Box>
            <Box component="main">
                <Box
                    role="tabpanel"
                    id="panel-create"
                    aria-labelledby="tab-create"
                    hidden={tab !== 0}
                >
                    {patternState === "ready" ? (
                        <CreateView />
                    ) : (
                        <Container maxWidth="sm" sx={{ py: 8, textAlign: "center" }}>
                            {patternError && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    {patternError}
                                </Alert>
                            )}
                            <BusyButton
                                variant="outlined"
                                busy={patternState === "loading"}
                                busyLabel="Loading artwork patterns…"
                                onClick={retryPatterns}
                            >
                                Retry loading patterns
                            </BusyButton>
                        </Container>
                    )}
                </Box>
                <Box role="tabpanel" id="panel-help" aria-labelledby="tab-help" hidden={tab !== 1}>
                    {tab === 1 && <HelpView />}
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
                        MUSIC / 1 &nbsp;·&nbsp; PATTERN / 1
                    </Typography>
                </Box>
            </Container>
        </ThemeProvider>
    );
}
