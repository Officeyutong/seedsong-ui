import { createTheme } from "@mui/material/styles";
export function makeTheme(mode: "light" | "dark") {
    return createTheme({
        palette: {
            mode,
            primary: { main: mode === "light" ? "#34654c" : "#9ed5ae" },
            secondary: { main: "#b97846" },
            background: {
                default: mode === "light" ? "#f5f5f0" : "#141b18",
                paper: mode === "light" ? "#ffffff" : "#1c2721",
            },
            ...(mode === "light"
                ? { text: { primary: "#233b2d", secondary: "#6f7971" }, divider: "#e4e9e2" }
                : {}),
        },
        typography: {
            fontFamily:
                '"Inter", "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            h3: { fontWeight: 650, letterSpacing: "-.055em" },
            h5: { fontWeight: 650, letterSpacing: "-.025em" },
            h6: { fontWeight: 600 },
            button: { textTransform: "none", fontWeight: 600 },
        },
        shape: { borderRadius: 12 },
        components: {
            MuiButton: {
                defaultProps: { disableElevation: true },
                styleOverrides: { root: { minHeight: 42, borderRadius: 9 } },
            },
            MuiPaper: {
                defaultProps: { elevation: 0 },
                styleOverrides: { root: { backgroundImage: "none" } },
            },
            MuiTab: {
                styleOverrides: { root: { minHeight: 56, textTransform: "none", fontWeight: 600 } },
            },
            MuiTextField: { defaultProps: { size: "small" } },
            MuiTooltip: { defaultProps: { arrow: true } },
        },
    });
}
