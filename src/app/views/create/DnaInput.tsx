import { Alert, Box, Stack, TextField, Typography } from "@mui/material";
import { ContentCopyRounded, RefreshRounded } from "@mui/icons-material";
import BusyButton from "../../common/BusyButton";
interface Props {
    value: string;
    error: string | null;
    onChange: (value: string) => void;
    onRandom: () => void;
    onCopy: () => void;
    busy: boolean;
    copying: boolean;
    disabled: boolean;
}
export default function DnaInput({
    value,
    error,
    onChange,
    onRandom,
    onCopy,
    busy,
    copying,
    disabled,
}: Props) {
    return (
        <Stack spacing={2.5}>
            <Box>
                <Typography variant="h6" gutterBottom>
                    Start with a seed
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Paste your DNA or discover something new at random.
                </Typography>
            </Box>
            <TextField
                label="32-byte DNA"
                multiline
                minRows={3}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                error={!!error}
                helperText={error || "Accepts a 0x prefix, spaces, hyphens, and underscores."}
                fullWidth
                slotProps={{
                    htmlInput: {
                        spellCheck: false,
                        "aria-label": "DNA input",
                        style: {
                            fontFamily: "var(--mono)",
                            fontSize: 14,
                            lineHeight: 1.9,
                            wordBreak: "break-all",
                        },
                    },
                }}
            />
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                <BusyButton
                    variant="outlined"
                    onClick={onRandom}
                    busy={busy}
                    busyLabel="Generating DNA…"
                    disabled={disabled}
                    startIcon={<RefreshRounded />}
                >
                    Random DNA
                </BusyButton>
                <BusyButton
                    onClick={onCopy}
                    busy={copying}
                    disabled={!!error}
                    startIcon={<ContentCopyRounded fontSize="small" />}
                >
                    Copy DNA
                </BusyButton>
            </Stack>
            <Alert
                severity="info"
                variant="outlined"
                sx={{ bgcolor: "action.hover", borderColor: "divider" }}
            >
                The same DNA produces the same notes and artwork. Save your DNA to recreate this
                piece.
            </Alert>
        </Stack>
    );
}
