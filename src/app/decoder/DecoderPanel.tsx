import { useState } from "react";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Chip,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { ExpandMoreRounded, SettingsInputComponentRounded } from "@mui/icons-material";
import BusyButton from "../common/BusyButton";
import type { DecoderSession } from "./engine";
import { normalizeSettings } from "./types";
import type { DecoderSettings } from "./types";
interface Props {
    initial: DecoderSettings;
    active: DecoderSession | null;
    loading: boolean;
    progress: string;
    error: string;
    onLoad: (settings: DecoderSettings) => Promise<void>;
    onCancel: () => void;
}
export default function DecoderPanel({
    initial,
    active,
    loading,
    progress,
    error,
    onLoad,
    onCancel,
}: Props) {
    const [draft, setDraft] = useState(initial);
    const [validation, setValidation] = useState("");
    const reference = active?.info.package.reference;
    const apply = async () => {
        setValidation("");
        try {
            const settings = normalizeSettings(draft);
            setDraft(settings);
            await onLoad(settings);
        } catch (error) {
            setValidation((error as Error).message);
        }
    };
    return (
        <Accordion defaultExpanded={!active} variant="outlined" sx={{ my: 3 }}>
            <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                >
                    <SettingsInputComponentRounded fontSize="small" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Decoder source
                    </Typography>
                    <Chip
                        size="small"
                        label={
                            reference
                                ? reference.source === "bundled"
                                    ? "Active: bundled"
                                    : "Active: on-chain ZIP"
                                : "No active decoder"
                        }
                    />
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                <Stack spacing={2}>
                    <TextField
                        select
                        label="Source"
                        value={draft.source}
                        disabled={loading}
                        onChange={(e) =>
                            setDraft({
                                ...draft,
                                source: e.target.value as DecoderSettings["source"],
                            })
                        }
                    >
                        <MenuItem value="bundled">Bundled with this website</MenuItem>
                        <MenuItem value="chain">Load from a CKB Cell</MenuItem>
                    </TextField>
                    {draft.source === "chain" && (
                        <>
                            <TextField
                                label="CKB RPC endpoint"
                                type="url"
                                value={draft.rpcUrl}
                                disabled={loading}
                                onChange={(e) => setDraft({ ...draft, rpcUrl: e.target.value })}
                                helperText="Defaults to the public testnet RPC. Custom endpoints must allow browser CORS requests."
                            />
                            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                                <TextField
                                    fullWidth
                                    label="Decoder transaction hash"
                                    value={draft.txHash}
                                    disabled={loading}
                                    onChange={(e) => setDraft({ ...draft, txHash: e.target.value })}
                                    helperText="A transaction hash or hash:index pointing to bundle.zip."
                                />
                                <TextField
                                    label="Output index"
                                    type="number"
                                    value={draft.index}
                                    disabled={loading}
                                    onChange={(e) =>
                                        setDraft({ ...draft, index: Number(e.target.value) })
                                    }
                                    slotProps={{ htmlInput: { min: 0, step: 1, max: 4294967295 } }}
                                    sx={{ minWidth: 140 }}
                                />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                                Downloads and runs the JS/WASM decoder stored in the selected Cell.
                                Its patterns and music specifications replace the bundled documents
                                after loading succeeds.
                            </Typography>
                        </>
                    )}
                    {(validation || error) && <Alert severity="error">{validation || error}</Alert>}
                    <Stack direction="row" spacing={1}>
                        <BusyButton
                            variant="contained"
                            onClick={() => void apply()}
                            busy={loading}
                            busyLabel={progress || "Loading decoder…"}
                        >
                            Load selected source
                        </BusyButton>
                        {loading && <Button onClick={onCancel}>Cancel loading</Button>}
                    </Stack>
                    {reference && (
                        <Box sx={{ overflowWrap: "anywhere" }}>
                            <Typography variant="caption" color="text.secondary">
                                Current source:{" "}
                                {reference.source === "bundled"
                                    ? "decoder and documents shipped with this website"
                                    : `${reference.txHash}:${reference.index}`}
                            </Typography>
                            {reference.source === "chain" && (
                                <>
                                    <Typography
                                        variant="caption"
                                        sx={{ display: "block" }}
                                        color="text.secondary"
                                    >
                                        RPC: {reference.rpcUrl}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ display: "block" }}
                                        color="text.secondary"
                                    >
                                        Archive data hash: {reference.archiveHash}
                                    </Typography>
                                </>
                            )}
                        </Box>
                    )}
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}
