import { useMemo } from "react";
import { Alert, Box, Stack, Typography } from "@mui/material";
import { MusicNoteRounded } from "@mui/icons-material";
import type { RenderedWav } from "seedsong-js";
import { useObjectUrl } from "../../hooks/useObjectUrl";
interface Props {
    wav: RenderedWav | null;
    stale: boolean;
    loop: boolean;
}
export default function MusicPlayer({ wav, stale, loop }: Props) {
    const blob = useMemo(() => (wav ? new Blob([wav.data], { type: "audio/wav" }) : null), [wav]);
    const url = useObjectUrl(blob);
    return (
        <Box sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: "divider" }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", ...{ mb: 1.5 } }}>
                <MusicNoteRounded fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Listen
                </Typography>
                {wav && (
                    <Typography variant="caption" color="text.secondary">
                        {wav.durationSeconds.toFixed(1)}s · {(wav.sampleRate / 1000).toFixed(1)} kHz
                    </Typography>
                )}
            </Stack>
            {stale && (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                    DNA or sound settings have changed. Generate music again to update the audio.
                </Alert>
            )}
            {url ? (
                <audio
                    key={url}
                    aria-label="Seedsong music player"
                    controls
                    loop={loop}
                    src={url}
                    style={{ width: "100%", height: 42 }}
                />
            ) : (
                <Box
                    sx={{ bgcolor: "action.hover", borderRadius: 2, textAlign: "center", py: 2.5 }}
                >
                    <Typography variant="body2" color="text.secondary">
                        Select “Generate music” to hear your DNA.
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
