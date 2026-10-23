import { useMemo } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { useObjectUrl } from "../../hooks/useObjectUrl";
import type { Traits } from "../../common/types";
interface Props {
    svg: string;
    traits: Traits;
}
export default function CoverPreview({ svg, traits }: Props) {
    const blob = useMemo(() => new Blob([svg], { type: "image/svg+xml" }), [svg]);
    const url = useObjectUrl(blob);
    return (
        <Box>
            <Box
                sx={{
                    position: "relative",
                    bgcolor: "#0B1026",
                    borderRadius: 2.5,
                    overflow: "hidden",
                    aspectRatio: "1",
                    width: "100%",
                }}
            >
                {url && (
                    <Box
                        component="img"
                        src={url}
                        alt={`Seedsong cover with the ${traits.Palette} palette and ${traits.Shape} shape`}
                        sx={{ width: "100%", height: "100%", display: "block" }}
                    />
                )}
            </Box>
            <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center", ...{ mt: 2 } }}
            >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Another expression of your DNA
                </Typography>
                <Chip
                    label="SVG · 512 × 512"
                    size="small"
                    variant="outlined"
                    sx={{ fontFamily: "var(--mono)", fontSize: 10 }}
                />
            </Stack>
        </Box>
    );
}
