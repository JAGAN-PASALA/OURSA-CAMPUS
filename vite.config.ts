import vinext from "vinext";
import { defineConfig } from "vite";

// Standalone local configuration: no hosting-only files or cloud services are required.
export default defineConfig({
  server: {
    host: "0.0.0.0",
    // Keep browser requests on the same origin in local and LAN development.
    // This prevents a session cookie issued for localhost from being lost when
    // the page is opened with the computer's LAN address (and vice versa).
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  plugins: [vinext()],
});
