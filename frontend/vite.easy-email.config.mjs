import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    outDir: "vendor",
    assetsDir: "",
    rollupOptions: {
      input: "easy-email-src/main.jsx",
      output: {
        entryFileNames: "easy-email-app.js",
        chunkFileNames: "easy-email-[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) return "easy-email-app.css";
          return "easy-email-[name][extname]";
        },
      },
    },
  },
});
