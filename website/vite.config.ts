import { defineConfig } from "vite";

export default defineConfig({
  build: { rollupOptions: { input: { main: "index.html", practice: "practice.html" } } },
  base: "/Lichess-AutoPlayer/",
});
