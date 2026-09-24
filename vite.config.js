import { defineConfig } from "vite";

// Dev-only CORS workaround: the browser blocks cross-origin calls to
// https://router.bynara.id from `vite dev` unless the server sends CORS headers.
// Same-origin `/bynara-api/*` is proxied to Bynara, so Test Connection / Run work
// in dev without changing production behaviour. To use it, set Endpoint to
// `/bynara-api` in the AI Config tab.
export default defineConfig({
  server: {
    proxy: {
      "/bynara-api": {
        target: "https://router.bynara.id/v1",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bynara-api/, "")
      }
    }
  }
});
