import { Box, Container, Link, Paper, Stack, Typography } from "@mui/material";
import { musicSpecUrl, patternUrl } from "../../common/specifications";

export default function HelpView() {
    return (
        <Container maxWidth="md" sx={{ py: 5 }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 650 }}>
                One DNA. One creation.
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
                Your music and artwork are generated entirely in your browser.
            </Typography>
            <Stack spacing={2}>
                {[
                    [
                        "01 · Start creating",
                        "Paste a 32-byte DNA, generate one at random, or choose musical and visual traits in the guided editor. Your DNA always reflects your current selections.",
                    ],
                    [
                        "02 · Preview the artwork",
                        "DOB/0 traits and a DOB/1 pattern define the SVG cover. Six artwork bytes select its palette, shape, texture, accents, orientation, and frame. Mode and tempo also influence the image.",
                    ],
                    [
                        "03 · Generate music",
                        "Select Generate music to create a 16-bar stereo WAV. The first render loads the music engine. Rendering runs in a Worker, so you can keep editing or cancel at any time.",
                    ],
                    [
                        "04 · Save your creation",
                        "Download the SVG, WAV, and DNA text file. The text file also records your music version and sound settings. Select that version in Sound settings and restore the saved settings to recreate the piece. Floating-point audio samples may vary across platforms.",
                    ],
                    [
                        "Randomization and seeds",
                        "Random DNA changes all bytes. Randomize this step changes only the current step. Randomize seeds preserves musical traits and artwork. The ensemble role identifies a part, while a single DNA still generates the full arrangement.",
                    ],
                ].map(([title, body]) => (
                    <Paper key={title} variant="outlined" sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: 16 }}>
                            {title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.9 }}>
                            {body}
                        </Typography>
                    </Paper>
                ))}
                <Box sx={{ pt: 2 }}>
                    <Typography variant="body2">
                        Default protocols: seedsong-music/2 · seedsong-pattern/1. Legacy music v1 is
                        available in Sound settings.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        The artwork patterns are read at runtime from the specification included
                        with the pinned music library.
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                        <Link href={musicSpecUrl} target="_blank" rel="noreferrer">
                            Music specification
                        </Link>
                        <Link href={patternUrl} target="_blank" rel="noreferrer">
                            DOB patterns
                        </Link>
                    </Stack>
                </Box>
            </Stack>
        </Container>
    );
}
