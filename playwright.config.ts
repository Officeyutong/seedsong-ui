import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
    testDir: "./test/browser",
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    use: {
        baseURL: "http://127.0.0.1:5173",
        headless: false,
        acceptDownloads: true,
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
        launchOptions: process.env.SEEDSONG_BROWSER
            ? { executablePath: process.env.SEEDSONG_BROWSER }
            : {},
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"] } },
        {
            name: "mobile",
            use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
        },
    ],
    webServer: {
        command: process.env.SEEDSONG_PREVIEW
            ? "npm run preview -- --host 127.0.0.1 --port 5173"
            : "npm run dev -- --host 127.0.0.1",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
    },
});
