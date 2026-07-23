import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    // Los tests de integración comparten la base: deben correr en serie.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // `server-only` aborta fuera de un React Server Component; en tests se
      // sustituye por un módulo vacío para poder importar la capa de servicio.
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
