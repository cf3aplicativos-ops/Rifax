import Link from "next/link";

const modulos = [
  { nombre: "Seguridad / RBAC", detalle: "Usuarios, roles y permisos" },
  { nombre: "Rifas y premios", detalle: "Configuración y estados" },
  { nombre: "Ventas y boletas", detalle: "Reserva, pago y anulación" },
  { nombre: "Pagos", detalle: "Pasarela, comprobantes, abonos" },
  { nombre: "Mensajería", detalle: "WhatsApp, SMS y correo" },
  { nombre: "Cobranza", detalle: "Cartera y gestiones" },
  { nombre: "Sorteos", detalle: "Ganadores y entregas" },
  { nombre: "Auditoría", detalle: "Hash encadenado verificable" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-6 py-16 dark:from-zinc-950 dark:to-black">
      <div className="mx-auto max-w-4xl">
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          En construcción · rama rifax2
        </span>
        <h1 className="mt-6 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          RIFAX <span className="text-red-600">2</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Plataforma de rifas masivas sobre Next.js, Prisma y Neon. Basada en el
          núcleo original RIFAX API (24 tablas, auditoría con hash encadenado).
        </p>

        <Link
          href="/login"
          className="mt-6 inline-flex items-center rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          Ingresar al panel →
        </Link>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modulos.map((m) => (
            <div
              key={m.nombre}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {m.nombre}
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {m.detalle}
              </p>
            </div>
          ))}
        </div>

        <footer className="mt-12 text-sm text-zinc-400">
          Next.js · Prisma · Neon · Vercel
        </footer>
      </div>
    </main>
  );
}
