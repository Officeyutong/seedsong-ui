import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const upstream = fileURLToPath(new URL("../vendor/seedsong-base/", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
function run(command, args, cwd = root) {
    execFileSync(command, args, { cwd, stdio: "inherit" });
}
run("git", ["submodule", "update", "--init", "--recursive"]);
run(npm, ["install"], upstream);
run(npm, ["run", "build:js"], upstream);
run(npm, ["install"]);
