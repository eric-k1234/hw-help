import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: Change base to match your repo name if different
export default defineConfig({
  plugins: [react()],
  base: "/homework-helper-full/",
});