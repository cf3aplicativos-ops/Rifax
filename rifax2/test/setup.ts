// Carga las variables de entorno (DATABASE_URL de Neon) para los tests.
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Falta DATABASE_URL. Ejecuta `vercel env pull .env` antes de correr los tests.",
  );
}
