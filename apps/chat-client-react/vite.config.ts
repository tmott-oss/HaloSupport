import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/chat-client/",
  plugins: [react()],
  server: {
    proxy: {
      "/chat": "http://localhost:3001"
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
