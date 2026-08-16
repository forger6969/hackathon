import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  server: {
    host: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        qr: resolve(import.meta.dirname, "qr.html"),
      },
    },
  },
});
