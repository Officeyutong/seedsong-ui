// Vite serves the pinned submodule documents as local assets. Pattern JSON is
// fetched and parsed in the browser; no source generation or remote API is needed.
import patternUrl from "../../../vendor/seedsong-base/pattern.md?url";
import musicSpecUrl from "../../../vendor/seedsong-base/spec.md?url";
import legacySpecUrl from "../../../vendor/seedsong-base/spec-v1.md?url";
export { patternUrl, musicSpecUrl, legacySpecUrl };
