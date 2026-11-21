import { defineConfig } from "vite";

// Cross-origin isolation enables SharedArrayBuffer so ONNX Runtime can use
// multithreaded WASM. `credentialless` still allows Scryfall card images.
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export default defineConfig({
  base: "./",
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  build: {
    rollupOptions: {
      input: {
        overlay: `${import.meta.dirname}/index.html`,
        settings: `${import.meta.dirname}/settings.html`,
      },
    },
  },
});
