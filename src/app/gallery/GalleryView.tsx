import { useEffect, useMemo, useRef, useState } from "react";
import { ccc } from "@ckb-ccc/connector-react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardActionArea,
    Chip,
    Container,
    LinearProgress,
    Link,
    Pagination,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import { RefreshRounded, CollectionsOutlined } from "@mui/icons-material";
import type { RenderedWav } from "seedsong-js";
import BusyButton from "../common/BusyButton";
import ErrorNotice from "../common/ErrorNotice";
import { errorMessage, isAbortError } from "../common/errors";
import { download, nextPaint } from "../common/download";
import { DecoderEngine, type DecoderSession } from "../decoder/engine";
import type { CoverResult } from "../decoder/types";
import { useObjectUrl } from "../hooks/useObjectUrl";
import MusicPlayer from "../views/create/MusicPlayer";
import TraitList from "../views/create/TraitList";
import { logError, logInfo, openLogPanel } from "../diagnostics/logs";
import {
    loadWalletRecords,
    verifyGalleryDecoder,
    type GalleryRecord,
    type GallerySnapshot,
} from "./api";

const PAGE_SIZE = 12;
interface Props {
    decoder: DecoderSession | null;
    sourceBusy: boolean;
    mintBusy: boolean;
}

export default function GalleryView({ decoder, sourceBusy, mintBusy }: Props) {
    const { open, close, disconnect, signerInfo, wallet, isOpen } = ccc.useCcc();
    const signer = signerInfo?.signer;
    const [refresh, setRefresh] = useState(0);
    const [state, setState] = useState<{
        identity: typeof signerInfo;
        snapshot: GallerySnapshot;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [progress, setProgress] = useState("");
    const [error, setError] = useState("");
    const controller = useRef<AbortController | null>(null);
    const snapshot = state?.identity === signerInfo ? state?.snapshot : undefined;
    useEffect(() => {
        const abort = new AbortController();
        controller.current = abort;
        void Promise.resolve()
            .then(async () => {
                if (abort.signal.aborted) return;
                setState(null);
                setProgress("");
                setError("");
                setBusy(Boolean(signer));
                if (!signer) return;
                const snapshot = await loadWalletRecords(signer, {
                    signal: abort.signal,
                    onProgress: setProgress,
                });
                if (!abort.signal.aborted) setState({ identity: signerInfo, snapshot });
            })
            .catch((error) => {
                if (!abort.signal.aborted && !isAbortError(error)) {
                    setError(errorMessage(error));
                    logError("Gallery", errorMessage(error));
                }
            })
            .finally(() => {
                if (controller.current === abort) setBusy(false);
            });
        return () => {
            abort.abort();
            controller.current = null;
        };
    }, [signer, signerInfo, refresh]);
    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Stack spacing={3}>
                <Box>
                    <Typography variant="h4">Your record collection</Typography>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                        Seedsong records held by your connected testnet wallet, read through the
                        light client.
                    </Typography>
                </Box>
                <Paper variant="outlined" sx={{ p: 3 }}>
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                            <BusyButton
                                variant="contained"
                                busy={isOpen}
                                disabled={mintBusy || busy || disconnecting}
                                onClick={() => open()}
                            >
                                {wallet ? `Wallet: ${wallet.name}` : "Connect wallet"}
                            </BusyButton>
                            {isOpen && <Button onClick={() => close()}>Close wallet picker</Button>}
                            {signer && (
                                <BusyButton
                                    startIcon={<RefreshRounded />}
                                    busy={busy}
                                    busyLabel="Loading records…"
                                    disabled={mintBusy}
                                    onClick={() => setRefresh((value) => value + 1)}
                                >
                                    Refresh records
                                </BusyButton>
                            )}
                            {busy && (
                                <Button
                                    onClick={() => {
                                        controller.current?.abort();
                                        setProgress(
                                            "Loading cancelled. Select Refresh records to try again.",
                                        );
                                    }}
                                >
                                    Cancel loading
                                </Button>
                            )}
                            {signer && (
                                <BusyButton
                                    disabled={mintBusy || busy}
                                    busy={disconnecting}
                                    onClick={() => {
                                        void (async () => {
                                            setDisconnecting(true);
                                            try {
                                                await disconnect();
                                            } catch (error) {
                                                setError(errorMessage(error));
                                            } finally {
                                                setDisconnecting(false);
                                            }
                                        })();
                                    }}
                                >
                                    Disconnect
                                </BusyButton>
                            )}
                            <Button onClick={openLogPanel}>View logs</Button>
                        </Stack>
                        {!signer && (
                            <Alert severity="info">
                                Connect a wallet to load its records. No signature or transaction is
                                required to browse.
                            </Alert>
                        )}
                        {busy && <LinearProgress aria-label="Loading wallet records" />}
                        {signer && progress && (
                            <Typography role="status" variant="body2">
                                {progress}
                            </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                            First-time wallet synchronization can take several minutes. For funds or
                            records older than the configured scan start, choose an earlier height
                            in Settings and reconnect.
                        </Typography>
                    </Stack>
                </Paper>
                {error && <ErrorNotice error={error} context="Could not load your collection" />}
                {snapshot && (
                    <>
                        <Stack
                            direction="row"
                            spacing={1}
                            useFlexGap
                            sx={{ flexWrap: "wrap", alignItems: "center" }}
                        >
                            <Chip
                                icon={<CollectionsOutlined />}
                                label={`${snapshot.records.length} records`}
                            />
                            <Typography variant="caption" color="text.secondary">
                                {snapshot.addresses.length} wallet address(es) · Checked{" "}
                                {new Date(snapshot.checkedAt).toLocaleString()}
                            </Typography>
                        </Stack>
                        {!!snapshot.skipped && (
                            <Alert severity="warning">
                                Skipped {snapshot.skipped} unsupported or malformed Spore Cell(s).
                                See Logs for their OutPoints.
                            </Alert>
                        )}
                        {!snapshot.records.length ? (
                            <Alert severity="info">
                                No Seedsong records were found in the synchronized wallet addresses.
                                After a mint confirms, refresh this collection.
                            </Alert>
                        ) : (
                            <Collection
                                key={snapshot.checkedAt}
                                records={snapshot.records}
                                decoder={decoder}
                                disabled={sourceBusy || mintBusy}
                            />
                        )}
                    </>
                )}
            </Stack>
        </Container>
    );
}

function Artwork({ cover, label }: { cover?: CoverResult; label: string }) {
    const blob = useMemo(
        () => (cover ? new Blob([cover.svg], { type: "image/svg+xml" }) : null),
        [cover],
    );
    const url = useObjectUrl(blob);
    return (
        <Box
            sx={{
                aspectRatio: "1",
                bgcolor: "action.hover",
                display: "grid",
                placeItems: "center",
            }}
        >
            {url ? (
                <Box
                    component="img"
                    src={url}
                    alt={label}
                    sx={{ width: "100%", height: "100%", display: "block" }}
                />
            ) : (
                <CollectionsOutlined color="disabled" sx={{ fontSize: 48 }} />
            )}
        </Box>
    );
}

function Collection({
    records,
    decoder,
    disabled,
}: {
    records: GalleryRecord[];
    decoder: DecoderSession | null;
    disabled: boolean;
}) {
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState(records[0].id);
    const [covers, setCovers] = useState<Record<string, CoverResult>>({});
    const [coverBusy, setCoverBusy] = useState(false);
    const [coverProgress, setCoverProgress] = useState("");
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const [rendering, setRendering] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [audio, setAudio] = useState<{
        recordId: string;
        decoderId: string;
        wav: RenderedWav;
    } | null>(null);
    const engine = useRef<DecoderEngine | null>(null);
    const request = useRef<object>({});
    const visible = useMemo(
        () => records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [records, page],
    );
    const selected = records.find((record) => record.id === selectedId)!;
    const validAudio =
        audio?.recordId === selected.id && audio.decoderId === decoder?.id ? audio.wav : null;
    useEffect(() => {
        request.current = {};
        const ownEngine = decoder && !disabled ? decoder.engine.fork() : null;
        engine.current = ownEngine;
        let active = true;
        void Promise.resolve()
            .then(async () => {
                if (!active) return;
                setCovers({});
                setReady(false);
                setAudio(null);
                setRendering(false);
                setError("");
                if (!decoder || !ownEngine) {
                    setCoverBusy(false);
                    return;
                }
                setCoverBusy(true);
                setCoverProgress("Verifying the collection's decoder release…");
                await verifyGalleryDecoder(decoder.info.package.reference);
                if (!active) return;
                for (const [index, record] of visible.entries()) {
                    setCoverProgress(`Decoding covers ${index + 1}/${visible.length}…`);
                    const cover = await ownEngine.cover(record.dna);
                    if (!active) return;
                    setCovers((previous) => ({ ...previous, [record.id]: cover }));
                }
                if (active) setReady(true);
            })
            .catch((error) => {
                if (active && !isAbortError(error)) {
                    setError(errorMessage(error));
                    logError("Gallery", errorMessage(error));
                }
            })
            .finally(() => {
                if (active) setCoverBusy(false);
            });
        return () => {
            active = false;
            ownEngine?.dispose();
            engine.current = null;
            request.current = {};
        };
    }, [decoder, disabled, visible, retry]);
    const cancelRender = () => {
        request.current = {};
        engine.current?.cancel();
        setRendering(false);
    };
    const select = (id: string) => {
        if (rendering) cancelRender();
        setAudio(null);
        setSelectedId(id);
    };
    const render = async () => {
        const ownEngine = engine.current;
        if (!ownEngine || !decoder || !ready || rendering) return;
        const id = {};
        request.current = id;
        setRendering(true);
        setError("");
        setAudio(null);
        logInfo("Gallery", `Rendering music v2 for Spore ${selected.sporeId}…`);
        try {
            const wav = await ownEngine.renderWav({
                dna: selected.dna,
                musicVersion: 2,
                timbre: "spec",
                sampleRate: 44100,
                reverb: 0.18,
                loop: false,
            });
            if (request.current === id) {
                setAudio({ recordId: selected.id, decoderId: decoder.id, wav });
                logInfo("Gallery", `Record audio ready (${wav.durationSeconds.toFixed(1)}s).`);
            }
        } catch (error) {
            if (request.current === id && !isAbortError(error)) {
                setError(errorMessage(error));
                logError("Gallery", errorMessage(error));
            }
        } finally {
            if (request.current === id) setRendering(false);
        }
    };
    return (
        <Stack spacing={3}>
            {!decoder && (
                <Alert severity="info">
                    Load a decoder in Settings to preview covers and generate music.
                </Alert>
            )}
            {coverBusy && (
                <Stack spacing={1}>
                    <LinearProgress />
                    <Typography role="status" variant="body2">
                        {coverProgress}
                    </Typography>
                </Stack>
            )}
            {error && (
                <>
                    <ErrorNotice error={error} context="Could not decode this collection" />
                    <BusyButton
                        busy={coverBusy}
                        disabled={!decoder || disabled}
                        onClick={() => setRetry((value) => value + 1)}
                    >
                        Retry decoding
                    </BusyButton>
                </>
            )}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                        md: "repeat(3, minmax(0, 1fr))",
                        lg: "repeat(4, minmax(0, 1fr))",
                    },
                    gap: 2,
                }}
            >
                {visible.map((record) => (
                    <Card
                        key={record.id}
                        variant="outlined"
                        sx={{ borderColor: record.id === selectedId ? "primary.main" : "divider" }}
                    >
                        <CardActionArea
                            aria-label={`Select record ${record.sporeId}`}
                            aria-pressed={record.id === selectedId}
                            onClick={() => select(record.id)}
                        >
                            <Artwork
                                cover={covers[record.id]}
                                label={`Seedsong cover ${record.sporeId}`}
                            />
                            <Box sx={{ p: 2 }}>
                                <Typography variant="subtitle2">
                                    Record {record.sporeId.slice(2, 10)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {covers[record.id]
                                        ? `${covers[record.id].traits.Mode} · ${covers[record.id].traits.Tempo} BPM`
                                        : "Select to view record details"}
                                </Typography>
                            </Box>
                        </CardActionArea>
                    </Card>
                ))}
            </Box>
            {records.length > PAGE_SIZE && (
                <Pagination
                    count={Math.ceil(records.length / PAGE_SIZE)}
                    page={page}
                    onChange={(_, value) => {
                        if (rendering) cancelRender();
                        setPage(value);
                        select(records[(value - 1) * PAGE_SIZE].id);
                    }}
                    aria-label="Collection pages"
                />
            )}
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack spacing={2}>
                    <Typography variant="h6">Selected record</Typography>
                    <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                        Spore ID: {selected.sporeId}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ overflowWrap: "anywhere", fontFamily: "var(--mono)" }}
                    >
                        DNA: {selected.dna}
                    </Typography>
                    <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>
                        Owner: {selected.owner}
                    </Typography>
                    <Link
                        href={`https://testnet.explorer.nervos.org/transaction/${selected.outPoint.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                    >
                        View transaction · Output {selected.outPoint.index.toString()}
                    </Link>
                    <Typography variant="caption">
                        Record capacity: {ccc.fixedPointToString(selected.capacity)} CKB · Music v2
                    </Typography>
                    {covers[selectedId] && <TraitList traits={covers[selectedId].traits} />}
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                        <BusyButton
                            variant="contained"
                            busy={rendering || coverBusy}
                            busyLabel={coverBusy ? "Loading artwork…" : "Generating music…"}
                            disabled={!ready || disabled}
                            onClick={() => void render()}
                        >
                            Generate music
                        </BusyButton>
                        {rendering && <Button onClick={cancelRender}>Cancel generation</Button>}
                        <BusyButton
                            busy={downloading}
                            disabled={!validAudio || disabled}
                            onClick={() => {
                                void (async () => {
                                    if (!validAudio) return;
                                    setDownloading(true);
                                    try {
                                        await nextPaint();
                                        download(
                                            validAudio.data,
                                            "audio/wav",
                                            `seedsong-${selected.sporeId.slice(2, 14)}.wav`,
                                        );
                                    } catch (error) {
                                        setError(errorMessage(error));
                                    } finally {
                                        setDownloading(false);
                                    }
                                })();
                            }}
                        >
                            Download WAV
                        </BusyButton>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        Decoder:{" "}
                        {decoder?.info.package.reference.source === "chain"
                            ? "Loaded from a CKB Cell"
                            : "Bundled with this website"}
                        . Music is generated locally; select Play below when it is ready.
                    </Typography>
                    <MusicPlayer
                        key={`${selected.id}:${decoder?.id}`}
                        wav={validAudio}
                        stale={false}
                        loop={false}
                    />
                </Stack>
            </Paper>
        </Stack>
    );
}
