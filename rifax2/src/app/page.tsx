import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-6 text-center dark:from-slate-950 dark:to-slate-900">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white shadow-lg shadow-indigo-600/30">
        R
      </div>
      <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
        RIFAX <span className="text-indigo-600">SaaS</span>
      </h1>
      <p className="mt-3 max-w-md text-slate-600 dark:text-slate-400">
        Plataforma multi-empresa para la gestión integral de rifas: sedes, ventas, cartera,
        sorteos verificables y auditoría.
      </p>
      <Link
        href="/login"
        className="mt-8 inline-flex items-center rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
      >
        Ingresar →
      </Link>
      <p className="mt-10 text-xs text-slate-400">Next.js · Prisma · Neon · Vercel</p>
    </main>
  );
}
