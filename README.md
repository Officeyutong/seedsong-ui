# Seedsong UI

An English-language React and Material UI studio for creating SVG artwork and 16-bar stereo music from 32-byte DNA. All rendering runs locally in the browser; audio synthesis runs in a dedicated Web Worker.

## Requirements

- Node.js 22+ and npm
- Git
- Rust with the `wasm32-unknown-unknown` target
- wasm-pack (`cargo install wasm-pack --locked`)

## Setup

```bash
git clone --recurse-submodules <this-repository>
cd seedsong-ui
rustup target add wasm32-unknown-unknown
npm run setup
npm run dev
```

`setup` initializes the pinned `vendor/seedsong-base` submodule, installs its build dependencies, builds `wasm/seedsong-js`, and installs the UI dependencies. The application consumes the package through the `seedsong-js` dependency; it does not import Rust bindings directly. `package-lock.json` is ignored by project convention.

If the repository is already checked out, `npm run setup` performs the same initialization. A regular `npm install` does not build the Rust dependency; run setup first on a fresh checkout.

```bash
npm run build
npm run preview
npm run lint
npm test
npm run test:browser
```

Browser tests open a visible browser. Install the browser once with `npx playwright install chromium`; a graphical display is required. The browser test does not use headless mode.

## Features

- Paste and validate hex DNA, including optional prefixes and separators.
- Generate random DNA using the music library.
- Edit DNA through five stages, preserving unrelated bytes and bitfields.
- Preview SVG artwork and musical traits from the pinned DOB/0 and DOB/1 patterns.
- Render WAV in a Worker, with cancellation, loading states, and stale-result detection.
- Play, seek, change volume, loop, and download audio.
- Select music v2 (default) or legacy v1 for reproducible playback and comparison.
- Download the exact SVG string and a DNA text file containing the music version and render settings.
- Responsive layouts, keyboard-accessible controls, light and dark themes.

DNA exports describe the current DNA and sound settings. After a matching render, their music version comes from the returned WAV metadata. If you edit DNA or settings, the previous audio is marked stale and its WAV download is disabled; the DNA export describes the new settings awaiting rendering. To recreate an export, paste its `dna` and restore its `settings`, including `musicVersion`, in Sound settings.

The initial DNA is the specification's reference example. Audio rendering starts only when requested. The DNA-selected timbre remains a collectible trait even when the piano playback override is selected.

## Dependency and protocol updates

`vendor/seedsong-base` is a Git submodule. Commit its Git link to pin the music code and specifications together. To upgrade, check out the intended upstream commit in that directory, run `npm run setup`, review the runtime patterns and regression tests, and commit the updated Git link. The submodule Git link pins the library and both specifications together.

The application fetches the pinned `pattern.md` at runtime and parses its DOB/0 and DOB/1 JSON arrays. Vite serves the document as a local asset, so production uses the same document without a remote API. Loading and retry controls include a button Loader. There is no synchronization script or generated pattern source. `spec.md` defines the music byte allocation. Musical decoding remains in the upstream Rust library; the UI only decodes the traits and edits DNA fields.

## Source layout

- `src/app/views`: header, creation workflow, and help page.
- `src/app/common`: runtime pattern loading, DNA editing, DOB decoding, downloads, and shared types.
- `src/app/hooks`: Worker lifecycle and Blob URL cleanup.
- `src/app/workers`: typed audio rendering protocol and Worker entry.
- `scripts`: Git submodule and music library setup.
- `test`: protocol and visible-browser integration tests.

The application is a static site. Production output in `dist/` includes the JS/WASM engine and Worker; the deployed host needs no Rust toolchain or audio backend. This release provides local creation; wallet integration and on-chain minting are outside its current scope.

## Automated build and publication

[Build and publish to deploy](.github/workflows/publish-deploy.yml) runs on every push to `main`. It can also be started manually from the Actions tab when `main` is selected.

The workflow checks out the pinned submodules, installs Linux build dependencies, Node.js 24, stable Rust, the `wasm32-unknown-unknown` target, and wasm-pack. It then runs `npm run setup` to build `seedsong-js` from source and install UI dependencies before running `npm run build`. No prebuilt local WASM files or npm lockfiles are required.

After a successful build, the workflow publishes the contents of `dist/` at the root of `deploy`, including the Worker and specification assets. `deploy` is reserved for build output: files absent from the new build are removed, and existing publication history is preserved. The branch is created on the first publication if it does not already exist. Failed builds do not publish, and newer runs cancel older runs.

Publication uses [actions-gh-pages](https://github.com/peaceiris/actions-gh-pages) with the built-in `GITHUB_TOKEN` and job-level `contents: write` permission. No additional token secret is required. Repository rules for `deploy` must permit the workflow's publication commits. This workflow updates the artifact branch; it does not configure a hosting provider or run the test suites.
