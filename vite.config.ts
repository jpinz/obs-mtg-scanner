import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";
import { overlayRelayPlugin } from "./server/overlayRelay";

// Cross-origin isolation enables SharedArrayBuffer so ONNX Runtime can use
// multithreaded WASM. `credentialless` still allows Scryfall card images.
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export default defineConfig({
  base: "./",
  plugins: [solid(), overlayRelayPlugin()],
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  build: {
    rollupOptions: {
      input: {
        app: `${import.meta.dirname}/index.html`,
        overlay: `${import.meta.dirname}/overlay.html`,
      },
    },
  },
});
