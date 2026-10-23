import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const reference = "9a401c07e8553fa2710c0000000000000209b62d000000000000000000000000";

test("DNA, wizard, SVG, real Worker WAV, and downloads work together", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Give your DNA a sound." })).toBeVisible();
    const input = page.getByRole("textbox", { name: "DNA input" });
    await input.fill("invalid");
    await expect(page.getByRole("button", { name: "Generate music", exact: true })).toBeDisabled();
    await expect(page.getByText("DNA can only contain")).toBeVisible();
    await input.fill(reference);
    await expect(page.getByRole("img", { name: /Seedsong cover/ })).toBeVisible();
    const svgDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG", exact: true }).click();
    const svgFile = await svgDownload;
    const svg = await readFile((await svgFile.path())!, "utf8");
    expect(svg).toContain("color='#F4D35E'");
    expect(
        await page.evaluate(
            (svg) =>
                new DOMParser()
                    .parseFromString(svg, "image/svg+xml")
                    .querySelector("parsererror") === null,
            svg,
        ),
    ).toBe(true);
    await page.getByRole("button", { name: "Guided editor", exact: true }).click();
    await page.getByRole("combobox", { name: "Tempo · BPM" }).click();
    await page.getByRole("option", { name: "140", exact: true }).click();
    await expect(page.getByText("140 BPM", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Paste DNA", exact: true }).click();
    expect(await input.inputValue()).not.toBe(reference);
    await input.fill(reference);
    await page.getByRole("button", { name: "Sound settings" }).click();
    await page.getByRole("combobox", { name: "Sample rate" }).click();
    await page.getByRole("option", { name: "22050 Hz" }).click();
    await page.getByRole("button", { name: "Generate music", exact: true }).click();
    await expect(
        page.getByRole("button", { name: /Loading music engine|Rendering music/ }),
    ).toHaveAttribute("aria-busy", "true");
    await expect(page.getByLabel("Seedsong music player")).toHaveAttribute("src", /^blob:/, {
        timeout: 45_000,
    });
    await expect(page.getByRole("button", { name: "Generate music", exact: true })).toBeEnabled();
    const audio = page.getByLabel("Seedsong music player");
    await expect
        .poll(() => audio.evaluate((element: HTMLAudioElement) => element.readyState))
        .toBeGreaterThan(0);
    const wavDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "WAV", exact: true }).click();
    const wavFile = await wavDownload;
    const bytes = await readFile((await wavFile.path())!);
    expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString()).toBe("WAVE");
    expect(bytes.readUInt32LE(24)).toBe(22050);
    await input.fill("00".repeat(32));
    await expect(page.getByText("DNA or sound settings have changed")).toBeVisible();
    await expect(page.getByRole("button", { name: "WAV", exact: true })).toBeDisabled();
    await page.getByRole("tab", { name: "Guide" }).click();
    await expect(page.getByRole("heading", { name: "One DNA. One creation." })).toBeVisible();
    await page.getByRole("tab", { name: "Create", exact: true }).click();
    await expect(input).toHaveValue("00".repeat(32));
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
    );
});

test("random generation and cancelling render leave the UI usable", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "DNA input" });
    await page.getByRole("button", { name: "Random DNA", exact: true }).click();
    await expect(input).not.toHaveValue(reference);
    expect(await input.inputValue()).toMatch(/^[a-f0-9]{64}$/);
    await page.getByRole("button", { name: "Generate music", exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("button", { name: "Generate music", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Random DNA", exact: true }).click();
    await expect(page.getByRole("button", { name: "Random DNA", exact: true })).toBeEnabled();
    await expect(
        page.getByRole("alert").filter({ hasText: "The music engine could not load" }),
    ).toHaveCount(0);
});
