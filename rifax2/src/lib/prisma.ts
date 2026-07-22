// Cliente Prisma como singleton.
// En desarrollo Next.js recarga los módulos con HMR; sin singleton se abrirían
// múltiples pools de conexiones. En serverless (Vercel) reutiliza la instancia
// entre invocaciones de la misma función.
//
// Prisma 7 (generador `prisma-client`) requiere un driver adapter. Usamos
// @prisma/adapter-pg sobre la conexión POOLED de Neon (DATABASE_URL), igual que
// el RIFAX API original que conectaba con `pg` por TCP.
//
// NOTA: el cliente tipado se genera con `prisma generate` en src/generated/prisma.
// Los modelos aparecen tras `prisma db pull` (Fase 2, ya con la base Neon).
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
