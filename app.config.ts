import { defineConfig } from "@solidjs/start/config";
import Icons from "unplugin-icons/vite";

export default defineConfig({
  vite: {
    plugins: [
      Icons({ compiler: "solid" })
    ]
  },
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