import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    prerender: {
      crawlLinks: false
    }
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 1200
    },
    optimizeDeps: {
      include: ['three']
    }
  }
});
