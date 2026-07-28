import Link from "next/link";
import { consultarVenta } from "@/lib/consulta";
import { money, fecha } from "@/lib/format";

export const dynamic = "force-dynamic";

const estadoClase: Record<string, string> = {
  pendiente_pago: "bg-amber-100 text-amber-800",
  parcial: "bg-blue-100 text-blue-800",
  pagada: "bg-emerald-100 text-emerald-800",
  anulada: "bg-slate-200 text-slate-600",
  vencida: "bg-red-100 text-red-800",
};

export default async function ConsultaPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams;
  const resultado = codigo ? await consultarVenta(codigo) : undefined;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">R</div>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">RIFAX</span>
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Consulta tu boleta</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ingresa el código de tu compra (ej. VTA-2026-000001) para ver el estado y si resultó ganadora.
          </p>

          <form method="get" className="mt-4 flex gap-2">
            <input
              name="codigo"
              defaultValue={codigo ?? ""}
              required
              placeholder="VTA-AAAA-NNNNNN"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">
              Consultar
            </button>
          </form>
        </div>

        {resultado === null ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            No encontramos ninguna compra con ese código. Verifica e intenta de nuevo.
          </p>
        ) : null}

        {resultado ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-slate-600 dark:text-slate-400">{resultado.codigo}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoClase[resultado.estado] ?? estadoClase.pendiente_pago}`}>
                  {resultado.estado.replace("_", " ")}
                </span>
              </div>
              <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{resultado.rifa.nombre}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{resultado.empresa} · sorteo {fecha(resultado.rifa.fecha_sorteo)}</p>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500 dark:text-slate-400">Cliente</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{resultado.cliente}</dd></div>
                <div><dt className="text-slate-500 dark:text-slate-400">Saldo</dt><dd className="font-medium text-slate-900 dark:text-slate-100">{money(resultado.saldo)}</dd></div>
              </dl>

              <p className="mt-4 text-xs font-medium uppercase text-slate-400">Tus números</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {resultado.numeros.map((n) => (
                  <span key={n} className="rounded-md bg-indigo-50 px-2 py-1 font-mono text-sm text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">{n}</span>
                ))}
              </div>
            </div>

            {resultado.ganadores.length > 0 ? (
              <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-6 text-center dark:border-emerald-600 dark:bg-emerald-950/50">
                <p className="text-3xl">🎉</p>
                <p className="mt-2 text-lg font-bold text-emerald-800 dark:text-emerald-300">¡Felicidades, ganaste!</p>
                {resultado.ganadores.map((g, i) => (
                  <p key={i} className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                    Boleta <span className="font-mono font-bold">{g.numero}</span> — {g.premio} · entrega: {g.estado_entrega.replace("_", " ")}
                  </p>
                ))}
              </div>
            ) : resultado.rifa.estado === "sorteada" ? (
              <p className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                La rifa ya se sorteó. Esta vez no resultaste ganador. ¡Gracias por participar!
              </p>
            ) : (
              <p className="rounded-xl bg-blue-50 px-4 py-3 text-center text-sm text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                La rifa aún no se sortea. ¡Mucha suerte!
              </p>
            )}
          </div>
        ) : null}

        <p className="mt-8 text-center text-xs text-slate-400">RIFAX · Consulta pública de boletas</p>
      </div>
    </main>
  );
}
