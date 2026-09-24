import { defineConfig } from "vite";

// Dev-only CORS workaround: the browser blocks cross-origin calls to
// https://opencode.ai from `vite dev` unless the server sends CORS headers.
// Same-origin `/go-api/*` is proxied to Zen, so Test Connection / Run work
// in dev without changing production behaviour. To use it, set Endpoint to
// `/go-api` in the AI Config tab.
export default defineConfig({
  server: {
    proxy: {
      "/go-api": {
        target: "https://opencode.ai/zen/go/v1",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/go-api/, "")
      }
    }
  }
});
