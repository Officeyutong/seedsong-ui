import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vite";

export default defineConfig({
    oxc: {
        jsx: { runtime: "automatic", importSource: "react" },
    },
    worker: { format: "es" },
    plugins: [
        react({ jsxRuntime: "automatic", jsxImportSource: "react" }),
        babel({ presets: [reactCompilerPreset()] }),
    ],
});
