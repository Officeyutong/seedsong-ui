import { createRequire } from "node:module";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vite";
import { lightClientLogs } from "./scripts/light-client-logs.ts";

const require = createRequire(import.meta.url);
const headers = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "credentialless",
};
export default defineConfig({
    server: { headers },
    preview: { headers },
    optimizeDeps: { exclude: ["@nervosnetwork/ckb-light-client-js"] },
    resolve: {
        alias: [
            { find: /^(?:node:)?stream$/, replacement: require.resolve("stream-browserify") },
            { find: /^buffer(?:\/index\.js)?\/?$/, replacement: require.resolve("buffer/") },
            {
                find: /^process(?:\/browser(?:\.js)?)?$/,
                replacement: require.resolve("process/browser"),
            },
            { find: /^events\/?$/, replacement: require.resolve("events/") },
        ],
    },
    oxc: {
        jsx: { runtime: "automatic", importSource: "react" },
    },
    worker: { format: "es" },
    plugins: [
        lightClientLogs(),
        react({ jsxRuntime: "automatic", jsxImportSource: "react" }),
        babel({ presets: [reactCompilerPreset()] }),
    ],
});
