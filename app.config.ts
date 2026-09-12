import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    prerender: {
      crawlLinks: false
    }
  },
  solid: {
    babel: {
      compact: true
    }
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 1200
    }
  }
});
