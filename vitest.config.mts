import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Igual que en tsconfig.json: "@/lib/x" significa "src/lib/x".
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node", // lógica pura: no necesitamos un navegador simulado
    include: ["src/**/*.test.ts"],
  },
});
