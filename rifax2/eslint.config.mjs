import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores de eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Código de referencia del rewrite, excluido también del type-check
    // (ver "exclude" en tsconfig.json). No es parte de la app.
    ".legacy_ref/**",
    // Scripts de mantenimiento ejecutados directamente con `node` (CommonJS
    // fuera del grafo de Next/TS); no siguen las reglas de la app.
    "scripts/**",
  ]),
  {
    rules: {
      // Convención ya usada en el repo: parámetros/variables no usados se
      // prefijan con "_" quedan exentos (p. ej. handlers con firma fija).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
