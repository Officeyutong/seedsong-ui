import { Box, Chip, Container, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { DarkModeOutlined, LightModeOutlined, GitHub, GraphicEqRounded } from "@mui/icons-material";
interface Props {
    dark: boolean;
    onToggleTheme: () => void;
}
export default function Header({ dark, onToggleTheme }: Props) {
    return (
        <Box
            component="header"
            sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}
        >
            <Container maxWidth="xl">
                <Stack
                    direction="row"
                    sx={{
                        alignItems: "center",
                        justifyContent: "space-between",
                        ...{ height: 76 },
                    }}
                >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        <Box
                            sx={{
                                bgcolor: "primary.main",
                                color: "background.paper",
                                width: 38,
                                height: 38,
                                borderRadius: "12px 12px 12px 3px",
                                display: "grid",
                                placeItems: "center",
                            }}
                        >
                            <GraphicEqRounded />
                        </Box>
                        <Typography variant="h6" sx={{ letterSpacing: "-.04em", fontSize: 23 }}>
                            seedsong<span style={{ color: "#91a58a" }}>.</span>
                        </Typography>
                        <Chip
                            label="LOCAL STUDIO"
                            size="small"
                            variant="outlined"
                            sx={{
                                display: { xs: "none", sm: "flex" },
                                fontSize: 10,
                                letterSpacing: ".12em",
                                borderRadius: 1,
                                ml: 1,
                            }}
                        />
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                        <Tooltip title={dark ? "Switch to light mode" : "Switch to dark mode"}>
                            <IconButton aria-label="Toggle theme" onClick={onToggleTheme}>
                                {dark ? <LightModeOutlined /> : <DarkModeOutlined />}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="View the music engine source">
                            <IconButton
                                aria-label="GitHub"
                                component="a"
                                href="https://github.com/Officeyutong/seedsong-base"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <GitHub fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Stack>
            </Container>
        </Box>
    );
}
