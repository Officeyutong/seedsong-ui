import { Box, Chip, Stack, Typography } from "@mui/material";
import type { Traits } from "../../common/types";
export default function TraitList({ traits }: { traits: Traits }) {
    return (
        <Box>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    my: 2.5,
                }}
            >
                {[
                    ["Mode", traits.Mode],
                    ["Tempo", `${traits.Tempo} BPM`],
                    ["Key / Form", `${traits.Key} · ${traits.Form}`],
                ].map(([label, value]) => (
                    <Box
                        key={label}
                        sx={{
                            py: 1.5,
                            px: 1.25,
                            "&:not(:last-child)": { borderRight: 1, borderColor: "divider" },
                        }}
                    >
                        <Typography variant="caption" color="text.secondary">
                            {label}
                        </Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, ...{ mt: 0.5 } }}>
                            {value}
                        </Typography>
                    </Box>
                ))}
            </Box>
            <Stack direction="row" sx={{ gap: 0.75, flexWrap: "wrap" }}>
                {["Lead", "Bass", "Contour", "Role"].map((name) => (
                    <Chip
                        key={name}
                        label={`${name} · ${traits[name]}`}
                        size="small"
                        sx={{ fontSize: 10, bgcolor: "action.hover" }}
                    />
                ))}
            </Stack>
        </Box>
    );
}
