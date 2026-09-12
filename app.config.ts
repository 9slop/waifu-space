import { defineConfig } from "@solidjs/start/config";
import Icons from "unplugin-icons/vite";

export default defineConfig({
  vite: {
    plugins: [
      Icons({ compiler: "solid" })
    ],
    build: {
      chunkSizeWarningLimit: 1200
    }
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
  }
});