import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    FormControlLabel,
    MenuItem,
    Slider,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { ExpandMoreRounded, TuneRounded } from "@mui/icons-material";
import type { RenderSettings as Settings } from "../../common/types";
interface Props {
    value: Settings;
    onChange: (value: Settings) => void;
}
export default function RenderSettings({ value, onChange }: Props) {
    return (
        <Accordion
            variant="outlined"
            disableGutters
            sx={{ "&:before": { display: "none" }, bgcolor: "transparent" }}
        >
            <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <TuneRounded fontSize="small" />
                    <Typography variant="body2">Sound settings</Typography>
                    <Typography variant="caption" color="text.secondary">
                        Keeps your DNA unchanged
                    </Typography>
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                <Stack spacing={2.5}>
                    <TextField
                        select
                        label="Music version"
                        fullWidth
                        value={value.musicVersion}
                        helperText="Use the saved version to reproduce a piece. Version 1 keeps the original algorithm."
                        onChange={(event) =>
                            onChange({
                                ...value,
                                musicVersion: Number(
                                    event.target.value,
                                ) as Settings["musicVersion"],
                            })
                        }
                    >
                        <MenuItem value={2}>Version 2 · Refined melody (default)</MenuItem>
                        <MenuItem value={1}>Version 1 · Legacy melody</MenuItem>
                    </TextField>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <TextField
                            select
                            label="Timbre"
                            fullWidth
                            value={value.timbre}
                            onChange={(event) =>
                                onChange({
                                    ...value,
                                    timbre: event.target.value as Settings["timbre"],
                                })
                            }
                        >
                            <MenuItem value="spec">DNA-selected timbres</MenuItem>
                            <MenuItem value="piano">Synthesized piano</MenuItem>
                        </TextField>
                        <TextField
                            select
                            label="Sample rate"
                            fullWidth
                            value={value.sampleRate}
                            onChange={(event) =>
                                onChange({ ...value, sampleRate: Number(event.target.value) })
                            }
                        >
                            {[22050, 44100, 48000, 96000].map((rate) => (
                                <MenuItem key={rate} value={rate}>
                                    {rate} Hz
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                    <BoxSlider
                        value={value.reverb}
                        onChange={(reverb) => onChange({ ...value, reverb })}
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={value.loop}
                                onChange={(_, loop) => onChange({ ...value, loop })}
                            />
                        }
                        label={<Typography variant="body2">Render a seamless loop</Typography>}
                    />
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}
function BoxSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
    return (
        <Stack>
            <Typography variant="body2" id="reverb-label">
                Reverb · {Math.round(value * 100)}%
            </Typography>
            <Slider
                aria-labelledby="reverb-label"
                value={value}
                min={0}
                max={1}
                step={0.01}
                valueLabelDisplay="auto"
                onChange={(_, next) => onChange(next as number)}
            />
        </Stack>
    );
}
