import { Box, Container, Link, Paper, Stack, Typography } from "@mui/material";
import type { DecoderSession } from "../../decoder/engine";

export default function HelpView({ decoder }: { decoder: DecoderSession }) {
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
                        "Select Generate music to create a 16-bar stereo WAV. The selected decoder runs in a Worker, so you can keep editing or cancel at any time.",
                    ],
                    [
                        "04 · Save your creation",
                        "Download the SVG, WAV, and DNA text file. The text file also records your music version and sound settings. Select that version in Sound settings and restore the saved settings to recreate the piece. Floating-point audio samples may vary across platforms.",
                    ],
                    [
                        "05 · Mint a record",
                        "Select Mint this DNA, connect an authorized testnet wallet and prepare a transaction. Review capacity, fees and the recipient before signing. Batch mint generates up to 50 unique DNA values and mints them atomically. The current collection requires its Cluster owner’s lock permission. Signed receipts support status checks and resending the same transaction after a network failure.",
                    ],
                    [
                        "Choose a decoder",
                        "Use Decoder source to keep the bundled engine or load a ZIP Cell through a CKB RPC endpoint. Load selected source applies the decoder, artwork patterns, and documents together. Cancel or a failed load keeps the current source. This RPC mode is separate from future light-client verification.",
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
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        Documents:{" "}
                        {decoder.info.package.source === "bundled"
                            ? "bundled with this website"
                            : "extracted from the selected on-chain ZIP"}
                        .
                    </Typography>
                    <Typography variant="body2">
                        Default protocols: seedsong-music/2 · seedsong-pattern/1. Legacy music v1 is
                        available in Sound settings.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        The artwork patterns are read at runtime from the specification included
                        with the active decoder source.
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                        <Link href={decoder.documentUrls.music} target="_blank" rel="noreferrer">
                            Music specification
                        </Link>
                        <Link href={decoder.documentUrls.legacy} target="_blank" rel="noreferrer">
                            Legacy music specification
                        </Link>
                        <Link href={decoder.documentUrls.pattern} target="_blank" rel="noreferrer">
                            DOB patterns
                        </Link>
                    </Stack>
                </Box>
            </Stack>
        </Container>
    );
}
