import { useState } from "react";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    IconButton,
    MenuItem,
    Stack,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import {
    ArrowBackRounded,
    ArrowForwardRounded,
    CasinoOutlined,
    ExpandMoreRounded,
    RefreshRounded,
} from "@mui/icons-material";
import { getPatterns } from "../../common/patterns";
import { decodeTraits } from "../../common/dob";
import {
    formatDna,
    randomizeBytes,
    randomizeTrait,
    setBits,
    setTrait,
    STEP_BYTES,
} from "../../common/dna";
import type { TraitValue } from "../../common/types";
const steps = ["Basics", "Melody", "Arrangement", "Artwork", "Review"];
const labels: Record<string, string> = {
    Mode: "Mode",
    Tempo: "Tempo · BPM",
    Key: "Key",
    Contour: "Melodic contour",
    Lead: "Lead timbre",
    Bass: "Bass timbre",
    Form: "Form",
    Role: "Ensemble role",
    Palette: "Palette",
    Shape: "Shape",
    Texture: "Texture",
    Accent: "Accents",
    Orientation: "Orientation",
    Frame: "Frame",
};
const descriptions = [
    "Set the musical foundation of your piece.",
    "Choose how the melody moves and how the instruments sound.",
    "Set the form and rhythm. The role identifies your part in an ensemble.",
    "Compose your artwork with six visual genes.",
    "Review your DNA. Seeds shape the melody and its variations.",
];
interface Props {
    dna: Uint8Array;
    onChange: (dna: Uint8Array) => void;
}
export default function DnaWizard({ dna, onChange }: Props) {
    const [step, setStep] = useState(0);
    const { dob0Pattern } = getPatterns();
    const traits = decodeTraits(dna);
    const changeTrait = (name: string, value: TraitValue) => onChange(setTrait(dna, name, value));
    const field = (name: string) => {
        const entry = dob0Pattern.find((item) => item[0] === name)!;
        const choices =
            entry[4] === "options"
                ? [...new Set(entry[5])]
                : Array.from({ length: 81 }, (_, i) => 60 + i);
        return (
            <Stack direction="row" spacing={0.5} key={name} sx={{ alignItems: "flex-start" }}>
                <TextField
                    select
                    fullWidth
                    label={labels[name]}
                    value={traits[name]}
                    onChange={(event) =>
                        changeTrait(
                            name,
                            name === "Tempo" ? Number(event.target.value) : event.target.value,
                        )
                    }
                >
                    {choices.map((value) => (
                        <MenuItem key={value} value={value}>
                            {value}
                        </MenuItem>
                    ))}
                </TextField>
                <Tooltip title={`Randomize ${labels[name]}`}>
                    <IconButton
                        aria-label={`Randomize ${labels[name]}`}
                        onClick={() => onChange(randomizeTrait(dna, name))}
                        sx={{ mt: 0.2 }}
                    >
                        <CasinoOutlined fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>
        );
    };
    const bitField = (
        label: string,
        offset: number,
        mask: number,
        shift: number,
        choices: string[],
    ) => (
        <TextField
            key={label}
            select
            label={label}
            value={(dna[offset] & mask) >> shift}
            fullWidth
            onChange={(event) =>
                onChange(setBits(dna, offset, mask, shift, Number(event.target.value)))
            }
        >
            {choices.map((value, i) => (
                <MenuItem key={i} value={i}>
                    {value}
                </MenuItem>
            ))}
        </TextField>
    );
    return (
        <Stack spacing={3}>
            <Stepper
                activeStep={step}
                alternativeLabel
                sx={{
                    "& .MuiStepLabel-label": { fontSize: 11 },
                    "& .MuiStep-root": { px: 0.25 },
                    "& .MuiStepLabel-labelContainer": { display: { xs: "none", sm: "block" } },
                }}
            >
                {steps.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>
            <Box>
                <Typography variant="h6">{steps[step]}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {descriptions[step]}
                </Typography>
            </Box>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 2.5,
                }}
            >
                {step === 0 && ["Mode", "Key", "Tempo"].map(field)}
                {step === 1 && ["Contour", "Lead", "Bass"].map(field)}
                {step === 2 && ["Form", "Role"].map(field)}
                {step === 3 &&
                    ["Palette", "Shape", "Texture", "Accent", "Orientation", "Frame"].map(field)}
            </Box>
            {step === 2 && (
                <Accordion
                    variant="outlined"
                    disableGutters
                    sx={{ "&:before": { display: "none" } }}
                >
                    <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                        <Typography variant="body2">Advanced arrangement and rhythm</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Stack spacing={2.5}>
                            {bitField(
                                "Chord progression",
                                2,
                                7,
                                0,
                                Array.from({ length: 8 }, (_, i) => `Template ${i + 1}`),
                            )}
                            {bitField("Bass pattern", 18, 12, 2, [
                                "B0 · Sustained root",
                                "B1 · Repeated root",
                                "B2 · Root and fifth",
                                "B3 · Alternating octaves",
                            ])}
                            {bitField("Pad pattern", 18, 48, 4, [
                                "P0 · Sustained chords",
                                "P1 · Half notes",
                                "P2 · Arpeggio",
                                "P3 · Offbeat",
                            ])}
                            {bitField("Drum pattern", 18, 192, 6, [
                                "K0 · Basic",
                                "K1 · Half-time",
                                "K2 · Four-on-the-floor",
                                "K3 · Ambient",
                            ])}
                            {bitField("Swing", 19, 3, 0, ["0% · A", "0% · B", "12%", "25%"])}
                            {bitField("Rhythm density", 19, 12, 2, [
                                "Standard · A",
                                "Sparse",
                                "Dense",
                                "Standard · B",
                            ])}
                        </Stack>
                    </AccordionDetails>
                </Accordion>
            )}
            {step === 4 && (
                <Stack spacing={2}>
                    <TextField
                        multiline
                        minRows={3}
                        label="Full DNA"
                        value={formatDna(dna)}
                        fullWidth
                        slotProps={{
                            htmlInput: {
                                readOnly: true,
                                style: {
                                    fontFamily: "var(--mono)",
                                    wordBreak: "break-all",
                                    lineHeight: 1.8,
                                },
                            },
                        }}
                    />
                    <Typography variant="body2" color="text.secondary">
                        Seed bytes are 6–9 and 20–31. Randomizing seeds preserves your musical
                        traits and artwork.
                    </Typography>
                </Stack>
            )}
            <Stack
                direction="row"
                sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    flexWrap: "wrap",
                }}
            >
                <Button
                    size="small"
                    startIcon={<RefreshRounded />}
                    onClick={() => onChange(randomizeBytes(dna, STEP_BYTES[step]))}
                >
                    {step === 4 ? "Randomize seeds" : "Randomize this step"}
                </Button>
                <Stack direction="row" spacing={1}>
                    <Button
                        disabled={step === 0}
                        startIcon={<ArrowBackRounded />}
                        onClick={() => setStep(step - 1)}
                    >
                        Back
                    </Button>
                    <Button
                        variant="outlined"
                        disabled={step === 4}
                        endIcon={<ArrowForwardRounded />}
                        onClick={() => setStep(step + 1)}
                    >
                        Next
                    </Button>
                </Stack>
            </Stack>
        </Stack>
    );
}
