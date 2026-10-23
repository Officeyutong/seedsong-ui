import { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    Container,
    Divider,
    Paper,
    Snackbar,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import {
    ArrowDownwardRounded,
    AutoAwesomeOutlined,
    CodeRounded,
    ContentCopyRounded,
    GraphicEqRounded,
    SaveAltRounded,
} from "@mui/icons-material";
import type { RenderedWav } from "seedsong-js";
import BusyButton from "../../common/BusyButton";
import { formatDna, parseDna, REFERENCE_DNA } from "../../common/dna";
import { decodeTraits, renderSvg } from "../../common/dob";
import { download, nextPaint } from "../../common/download";
import type { RenderSettings as Settings, RenderSnapshot } from "../../common/types";
import { useMusicRenderer } from "../../hooks/useMusicRenderer";
import DnaInput from "./DnaInput";
import DnaWizard from "./DnaWizard";
import CoverPreview from "./CoverPreview";
import TraitList from "./TraitList";
import RenderSettings from "./RenderSettings";
import MusicPlayer from "./MusicPlayer";
const initialSettings: Settings = { timbre: "spec", sampleRate: 44100, reverb: 0.18, loop: false };
export default function CreateView() {
    const [raw, setRaw] = useState(REFERENCE_DNA);
    const [lastValid, setLastValid] = useState(() => parseDna(REFERENCE_DNA));
    const [mode, setMode] = useState<"input" | "wizard">("input");
    const [settings, setSettings] = useState(initialSettings);
    const [busy, setBusy] = useState<"render" | "random" | null>(null);
    const [actionBusy, setActionBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState("");
    const [result, setResult] = useState<{
        wav: RenderedWav;
        snapshot: RenderSnapshot;
    } | null>(null);
    const music = useMusicRenderer();
    let validation: string | null = null;
    try {
        parseDna(raw);
    } catch (error) {
        validation = (error as Error).message;
    }
    const dna = formatDna(lastValid);
    const traits = useMemo(() => decodeTraits(lastValid), [lastValid]);
    const svg = useMemo(() => renderSvg(traits), [traits]);
    const stale =
        !!result &&
        (validation !== null ||
            result.snapshot.dna !== dna ||
            JSON.stringify(result.snapshot.settings) !== JSON.stringify(settings));
    const acceptDna = (next: Uint8Array) => {
        setLastValid(Uint8Array.from(next));
        setRaw(formatDna(next));
        setError(null);
    };
    const editRaw = (value: string) => {
        setRaw(value);
        setError(null);
        try {
            setLastValid(parseDna(value));
        } catch {
            /* Retain the last valid preview while the user types. */
        }
    };
    const handleRandom = async () => {
        setBusy("random");
        setError(null);
        try {
            acceptDna(parseDna(await music.randomDna()));
        } catch (error) {
            if ((error as Error).name !== "AbortError") setError((error as Error).message);
        } finally {
            setBusy(null);
        }
    };
    const handleRender = async () => {
        setBusy("render");
        setError(null);
        const snapshot: RenderSnapshot = { dna, settings: { ...settings } };
        try {
            const wav = await music.renderWav({ dna: snapshot.dna, ...snapshot.settings });
            setResult({ wav, snapshot });
            setNotice("Your music is ready to play or download.");
        } catch (error) {
            if ((error as Error).name !== "AbortError") setError((error as Error).message);
        } finally {
            setBusy(null);
        }
    };
    const runAction = async (name: string, action: () => void | Promise<void>, message: string) => {
        setActionBusy(name);
        try {
            await nextPaint();
            await action();
            setNotice(message);
        } catch (error) {
            setError((error as Error).message);
        } finally {
            setActionBusy(null);
        }
    };
    const name = `seedsong-${dna.slice(0, 12)}`;
    return (
        <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4.5 } }}>
            <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "flex-start", sm: "center" },
                    gap: 2,
                    ...{ mb: 3.5 },
                }}
            >
                <Box>
                    <Typography
                        variant="overline"
                        sx={{ color: "primary.main", letterSpacing: ".2em", fontSize: 10 }}
                    >
                        32 BYTES. ENDLESS POSSIBILITIES.
                    </Typography>
                    <Typography variant="h3" sx={{ fontSize: { xs: 29, md: 38 }, mt: 0.5 }}>
                        Give your DNA a sound<span style={{ color: "#86a17d" }}>.</span>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                        Grow music and artwork from a single seed.
                    </Typography>
                </Box>
                <Chip
                    icon={
                        <Box
                            component="span"
                            sx={{
                                width: 6,
                                height: 6,
                                bgcolor: "#6e9b73",
                                borderRadius: "50%",
                                ml: "12px !important",
                            }}
                        />
                    }
                    label="Generated locally"
                    variant="outlined"
                    size="small"
                    sx={{ bgcolor: "background.paper", fontSize: 11 }}
                />
            </Stack>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.15fr) minmax(0, .85fr)" },
                    gap: 3,
                    alignItems: "start",
                }}
            >
                <Stack spacing={2.5}>
                    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                        <Stack
                            direction="row"
                            sx={{
                                justifyContent: "space-between",
                                alignItems: "center",
                                ...{
                                    px: { xs: 2, sm: 3 },
                                    py: 2,
                                    borderBottom: 1,
                                    borderColor: "divider",
                                },
                            }}
                        >
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                <Box className="section-number">01</Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    Edit your DNA
                                </Typography>
                            </Stack>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontFamily: "var(--mono)" }}
                            >
                                32 BYTES
                            </Typography>
                        </Stack>
                        <Box sx={{ p: { xs: 2, sm: 3 } }}>
                            <ToggleButtonGroup
                                exclusive
                                value={mode}
                                onChange={(_, value) => {
                                    if (value) setMode(value);
                                }}
                                size="small"
                                fullWidth
                                sx={{
                                    mb: 3,
                                    "& .MuiToggleButton-root": {
                                        py: 1.2,
                                        textTransform: "none",
                                        gap: 1,
                                    },
                                }}
                            >
                                <ToggleButton value="input">
                                    <CodeRounded fontSize="small" />
                                    Paste DNA
                                </ToggleButton>
                                <ToggleButton value="wizard" disabled={!!validation}>
                                    <AutoAwesomeOutlined fontSize="small" />
                                    Guided editor
                                </ToggleButton>
                            </ToggleButtonGroup>
                            {mode === "input" ? (
                                <DnaInput
                                    value={raw}
                                    error={validation}
                                    onChange={editRaw}
                                    onRandom={handleRandom}
                                    onCopy={() =>
                                        void runAction(
                                            "copy",
                                            () => navigator.clipboard.writeText(dna),
                                            "DNA copied.",
                                        )
                                    }
                                    busy={busy === "random"}
                                    copying={actionBusy === "copy"}
                                    disabled={busy !== null}
                                />
                            ) : (
                                <DnaWizard dna={lastValid} onChange={acceptDna} />
                            )}
                        </Box>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center", ...{ mb: 2.5 } }}
                        >
                            <Box className="section-number">02</Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Listen to your creation
                            </Typography>
                        </Stack>
                        <RenderSettings value={settings} onChange={setSettings} />
                        <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
                            <BusyButton
                                variant="contained"
                                size="large"
                                fullWidth
                                startIcon={<GraphicEqRounded />}
                                busy={busy === "render"}
                                disabled={!!validation || busy === "random"}
                                busyLabel={
                                    music.engine === "loading"
                                        ? "Loading music engine…"
                                        : "Rendering music…"
                                }
                                onClick={handleRender}
                            >
                                Generate music
                            </BusyButton>
                            {busy && <Button onClick={music.cancel}>Cancel</Button>}
                        </Stack>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mt: 1.5, lineHeight: 1.8 }}
                        >
                            16 bars · Stereo WAV
                            {busy === "render"
                                ? " · You can keep editing. Changes apply to the next render."
                                : " · The first render loads the music engine."}
                        </Typography>
                        {error && (
                            <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 2 }}>
                                {error}
                            </Alert>
                        )}
                    </Paper>
                    <Box sx={{ px: 0.5 }}>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                            <Box
                                component="span"
                                sx={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: "50%",
                                    bgcolor: "text.secondary",
                                }}
                            />
                            Music and artwork from the same DNA. Everything stays in your browser.
                        </Typography>
                    </Box>
                </Stack>
                <Paper
                    variant="outlined"
                    sx={{ p: { xs: 2, sm: 3 }, position: { md: "sticky" }, top: 24 }}
                >
                    <Stack
                        direction="row"
                        sx={{
                            justifyContent: "space-between",
                            alignItems: "center",
                            ...{ mb: 2.5 },
                        }}
                    >
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                            <Box className="section-number">03</Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Your creation
                            </Typography>
                        </Stack>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontFamily: "var(--mono)" }}
                        >
                            {dna.slice(0, 8)}…
                        </Typography>
                    </Stack>
                    {validation && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            Your input is incomplete. Showing the last valid DNA preview.
                        </Alert>
                    )}
                    <CoverPreview svg={svg} traits={traits} />
                    <TraitList traits={traits} />
                    <MusicPlayer
                        wav={result?.wav ?? null}
                        stale={stale}
                        loop={result?.snapshot.settings.loop ?? false}
                    />
                    <Divider sx={{ my: 2.5 }} />
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                        <BusyButton
                            size="small"
                            variant="outlined"
                            startIcon={<SaveAltRounded fontSize="small" />}
                            busy={actionBusy === "wav"}
                            disabled={!result || stale || !!validation || actionBusy !== null}
                            onClick={() =>
                                void runAction(
                                    "wav",
                                    () => download(result!.wav.data, "audio/wav", `${name}.wav`),
                                    "WAV download started.",
                                )
                            }
                        >
                            WAV
                        </BusyButton>
                        <BusyButton
                            size="small"
                            variant="outlined"
                            startIcon={<ArrowDownwardRounded fontSize="small" />}
                            busy={actionBusy === "svg"}
                            disabled={!!validation || actionBusy !== null}
                            onClick={() =>
                                void runAction(
                                    "svg",
                                    () => download(svg, "image/svg+xml", `${name}.svg`),
                                    "SVG download started.",
                                )
                            }
                        >
                            SVG
                        </BusyButton>
                        <BusyButton
                            size="small"
                            variant="outlined"
                            startIcon={<ContentCopyRounded fontSize="small" />}
                            busy={actionBusy === "dna"}
                            disabled={!!validation || actionBusy !== null}
                            onClick={() =>
                                void runAction(
                                    "dna",
                                    () =>
                                        download(
                                            JSON.stringify(
                                                {
                                                    dna,
                                                    settings,
                                                    music: "seedsong-music/1",
                                                    pattern: "seedsong-pattern/1",
                                                },
                                                null,
                                                2,
                                            ),
                                            "text/plain;charset=utf-8",
                                            `${name}.dna.txt`,
                                        ),
                                    "DNA and sound settings saved.",
                                )
                            }
                        >
                            DNA
                        </BusyButton>
                    </Stack>
                </Paper>
            </Box>
            <Snackbar
                open={!!notice}
                autoHideDuration={3500}
                onClose={() => setNotice("")}
                message={notice}
            />
        </Container>
    );
}
