import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        reception: resolve(import.meta.dirname, 'reception.html'),
      },
    },
  },
});
