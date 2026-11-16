import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sdkArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!sdkArg)
    throw new Error(
        "Usage: node scripts/pack-light-client.mjs /path/to/ckb-light-client [--pack-only]",
    );
const sdk = resolve(sdkArg);
const destination = resolve(
    process.env.SEEDSONG_SDK_PACKAGE_DIR ?? join(root, "vendor/ckb-light-client"),
);
const metadata = JSON.parse(readFileSync(join(destination, "release.json"), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const execute = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: "inherit" });
const output = (args) => execFileSync("git", args, { cwd: sdk });
if (output(["rev-parse", "HEAD"]).toString().trim() !== metadata.sourceCommit)
    throw new Error("SDK checkout does not match release.json sourceCommit.");
const actualPatch = output(["diff", "--binary", "--full-index", "HEAD"]);
if (metadata.patchSha256) {
    const patch = readFileSync(join(destination, "index-replay.patch"));
    if (sha256(patch) !== metadata.patchSha256)
        throw new Error("SDK source patch checksum mismatch.");
    if (sha256(actualPatch) !== metadata.patchSha256)
        throw new Error(
            "SDK working tree must contain exactly index-replay.patch; apply it to the pinned commit first.",
        );
} else if (actualPatch.length) {
    throw new Error("The pinned PR SDK checkout must have no source changes.");
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
if (!process.argv.includes("--pack-only")) {
    for (const workspace of [
        "ckb-light-client-db-worker",
        "ckb-light-client-wasm",
        "@nervosnetwork/ckb-light-client-js",
    ])
        execute(npm, ["run", "build", `--workspace=${workspace}`], sdk);
}
const wasmPath = join(sdk, "wasm/light-client-wasm/pkg/light-client-wasm_bg.wasm");
const wasm = readFileSync(wasmPath);
if (
    (metadata.requiresIndexRepair ?? Boolean(metadata.patchSha256)) &&
    !wasm.includes(Buffer.from("SCRIPT_INDEX_REPLAY_VERSION"))
)
    throw new Error(
        "Built WASM does not contain the script-index repair migration. Rebuild the SDK.",
    );
const staging = mkdtempSync(join(tmpdir(), "seedsong-light-client-package-"));
try {
    const upstream = join(sdk, "wasm/light-client-js");
    const manifest = JSON.parse(readFileSync(join(upstream, "package.json"), "utf8"));
    const packaged = {
        name: manifest.name,
        version: metadata.packageVersion,
        type: "module",
        main: "dist/index.js",
        types: "dist/index.d.ts",
        exports: {
            ".": {
                types: "./dist/index.d.ts",
                import: "./dist/index.js",
                default: "./dist/index.js",
            },
        },
        license: manifest.license,
        repository: manifest.repository,
        dependencies: manifest.dependencies,
        seedsongSource: {
            repository: metadata.sourceRepository,
            pullRequest: metadata.sourcePullRequest,
            commit: metadata.sourceCommit,
            patchSha256: metadata.patchSha256,
            wasmSha256: sha256(wasm),
        },
    };
    mkdirSync(join(staging, "dist"));
    for (const name of readdirSync(join(upstream, "dist"))) {
        if (name === "index.js" || name.endsWith(".d.ts")) {
            const target = join(staging, "dist", name);
            const content = readFileSync(join(upstream, "dist", name), "utf8").replace(
                /^\/\/[#@] sourceMappingURL=.*$/gm,
                "",
            );
            writeFileSync(target, content);
        }
    }
    copyFileSync(join(sdk, "LICENSE"), join(staging, "LICENSE"));
    writeFileSync(join(staging, "package.json"), `${JSON.stringify(packaged, null, 2)}\n`);
    execute(npm, ["pack", "--ignore-scripts", "--pack-destination", destination], staging);
    const archive = join(destination, metadata.archive);
    metadata.archiveSha256 = sha256(readFileSync(archive));
    metadata.wasmSha256 = sha256(wasm);
    metadata.bundleSha256 = sha256(readFileSync(join(staging, "dist/index.js")));
    writeFileSync(join(destination, "release.json"), `${JSON.stringify(metadata, null, 2)}\n`);
    console.log(`Packed ${archive}`);
} finally {
    rmSync(staging, { recursive: true, force: true });
}
