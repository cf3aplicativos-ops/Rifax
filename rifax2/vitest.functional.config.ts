import { defineConfig } from "vitest/config";
import path from "node:path";

// Suite funcional: ejecuta la lógica real de cada módulo contra la base de
// datos real de Neon, dentro de una empresa (tenant) de prueba desechable
// que se crea al empezar y se purga por completo al terminar. Separada de
// vitest.config.ts para no correrla en cada `npm test` normal.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    include: ["test/functional/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
