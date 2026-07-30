import Link from "next/link";
import type { Metadata } from "next";
import GanadoresVivo from "./ganadores-vivo";
import Carrusel from "./carrusel";
import { slidesLanding } from "@/lib/landing-slides";

export const metadata: Metadata = {
  title: "RIFAX SaaS — Plataforma multi-empresa de gestión de rifas",
  description:
    "Gestiona rifas, sedes, ventas, cartera y sorteos verificables desde una sola plataforma multi-empresa. Auditoría con hash encadenado, control de concurrencia y roles.",
};

const features = [
  {
    icon: <IconTicket />,
    title: "Rifas y boletas",
    desc: "Crea rifas por sede, publica y materializa hasta un millón de boletas al instante, con estados y premios.",
  },
  {
    icon: <IconCart />,
    title: "Ventas sin errores",
    desc: "Control de concurrencia real: es imposible vender dos veces la misma boleta. Abonos con aritmética exacta.",
  },
  {
    icon: <IconWallet />,
    title: "Cartera y cobranza",
    desc: "Saldos pendientes clasificados por tramo de mora, con seguimiento por cliente y por sede.",
  },
  {
    icon: <IconShield />,
    title: "Sorteos verificables",
    desc: "Modalidad commit-reveal: publicamos el hash antes y la semilla después. Cualquiera puede recalcular al ganador.",
  },
  {
    icon: <IconBuildings />,
    title: "Multi-empresa y sedes",
    desc: "Una plataforma, muchas empresas. Cada una con sus sedes, usuarios, roles y datos totalmente aislados.",
  },
  {
    icon: <IconLock />,
    title: "Auditoría íntegra",
    desc: "Cada operación queda en una bitácora con hash encadenado (SHA-256). Registro inalterable y verificable.",
  },
];

const pasos = [
  { n: "1", t: "Crea tu empresa", d: "El administrador da de alta la empresa y sus sedes autorizadas." },
  { n: "2", t: "Configura rifas", d: "Define rifas por sede, precios, premios y vendedores con sus talonarios." },
  { n: "3", t: "Vende y cobra", d: "Registra ventas y abonos; controla la cartera y la mora en tiempo real." },
  { n: "4", t: "Sortea y audita", d: "Ejecuta sorteos verificables y revisa la auditoría de punta a punta." },
];

const planes = [
  {
    nombre: "Básico",
    para: "Una empresa que arranca su operación",
    precio: "$99.000",
    periodo: "/ mes",
    destacado: true,
    cta: "Ingresar",
    incluye: [
      "Hasta 2 sedes",
      "Hasta 5 usuarios",
      "Rifas, ventas y cartera",
      "Vendedores y talonarios",
      "Sorteos verificables",
      "Reportes y branding propio",
      "Portal de cliente y auditoría",
    ],
  },
  {
    nombre: "Corporativo",
    para: "Operación multi-sede a gran escala",
    precio: "A medida",
    periodo: "",
    destacado: false,
    cta: "Contáctanos",
    incluye: [
      "Sedes y usuarios ilimitados",
      "Vendedores ilimitados + liquidación masiva",
      "Portales de vendedor y cliente",
      "Integraciones (pasarela, WhatsApp/SMS)",
      "Conciliación con IA",
      "SLA, soporte prioritario y capacitación",
      "Datos totalmente aislados por empresa",
    ],
  },
];

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* NAV */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1e293b] text-lg font-black text-[#f5c518] shadow-lg shadow-slate-900/25">
              R
            </div>
            <span className="text-lg font-black tracking-tight">
              RIFA<span className="text-[#eab308]">X</span>
            </span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            <a href="#caracteristicas" className="transition hover:text-slate-900 dark:hover:text-white">Características</a>
            <a href="#como-funciona" className="transition hover:text-slate-900 dark:hover:text-white">Cómo funciona</a>
            <a href="#precios" className="transition hover:text-slate-900 dark:hover:text-white">Precios</a>
            <a href="#contacto" className="transition hover:text-slate-900 dark:hover:text-white">Contacto</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/consulta" className="hidden rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-block dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
              Consultar boleta
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-[#f5c518] px-4 py-2 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-[#eab308]"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      {/* CARRUSEL configurable (parte superior) */}
      <Carrusel slides={slidesLanding} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-amber-400/25 blur-3xl dark:bg-amber-500/15" />
        </div>
        <div className="mx-auto max-w-4xl px-6 py-24 text-center sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f5c518]" /> Plataforma multi-empresa
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
            La gestión de rifas,
            <br className="hidden sm:block" /> <span className="text-[#eab308]">simple y confiable</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            Administra rifas, sedes, ventas, cartera y sorteos verificables desde un solo lugar. Con
            control de concurrencia, roles y auditoría a prueba de manipulaciones.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="w-full rounded-lg bg-[#f5c518] px-6 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/25 transition hover:bg-[#eab308] sm:w-auto"
            >
              Ingresar a la plataforma →
            </Link>
            <a
              href="#caracteristicas"
              className="w-full rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Ver características
            </a>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500 dark:text-slate-400">
            <Stat valor="Multi-sede" etiqueta="por empresa" />
            <span className="hidden h-4 w-px bg-slate-300 sm:block dark:bg-slate-700" />
            <Stat valor="Anti-doble-venta" etiqueta="garantizado" />
            <span className="hidden h-4 w-px bg-slate-300 sm:block dark:bg-slate-700" />
            <Stat valor="Auditoría" etiqueta="hash encadenado" />
          </div>
        </div>
      </section>

      {/* RESULTADOS EN VIVO */}
      <GanadoresVivo />

      {/* FEATURES */}
      <section id="caracteristicas" className="border-t border-slate-100 bg-white py-20 dark:border-slate-900 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Todo lo que tu operación necesita</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Del alta de la rifa hasta la entrega del premio, en un flujo controlado y auditable.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-amber-300 hover:shadow-lg hover:shadow-amber-500/10 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-800/60"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-[#1e293b] group-hover:text-[#f5c518] dark:bg-amber-950/40 dark:text-amber-300">
                  {f.icon}
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Cómo funciona</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">Cuatro pasos, de la configuración al sorteo.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pasos.map((p, i) => (
              <div key={p.n} className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e293b] text-sm font-bold text-[#f5c518]">
                  {p.n}
                </div>
                {i < pasos.length - 1 ? (
                  <div className="absolute left-10 top-5 hidden h-px w-[calc(100%-2.5rem)] bg-gradient-to-r from-amber-300 to-transparent lg:block dark:from-amber-800/60" />
                ) : null}
                <h3 className="mt-4 font-semibold">{p.t}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEGURIDAD / TRUST */}
      <section id="seguridad" className="border-t border-slate-100 bg-slate-50 py-20 dark:border-slate-900 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wide text-amber-600">Confianza</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Transparencia verificable</h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Los sorteos usan el esquema <strong>commit-reveal</strong>: publicamos el hash de una
              semilla secreta antes del sorteo y revelamos la semilla después. El número ganador se
              deriva de forma determinista, así que cualquiera puede recomputarlo y comprobar que no
              hubo manipulación.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Bitácora de auditoría con hash encadenado (SHA-256) inalterable.",
                "Aislamiento total de datos entre empresas.",
                "Roles y permisos por usuario y por sede.",
                "Control de concurrencia que evita la doble venta.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <IconCheck />
                  <span className="text-slate-700 dark:text-slate-300">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 font-mono text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs text-slate-400">verificación de sorteo</p>
            <pre className="mt-3 overflow-x-auto text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
{`semilla   = a42daff7…67e5d60138
commit    = sha256(semilla)
          = 6db29c3d99bc…
ganador   = min + (sha256(semilla) mod N)
          = 132  ✓ verificable`}
            </pre>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <IconCheck /> Cadena de auditoría íntegra
            </div>
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Planes para cada operación</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Empieza pequeño y crece por sedes. Sin permanencia.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
            {planes.map((p) => (
              <div
                key={p.nombre}
                className={`relative flex flex-col rounded-2xl border p-7 ${
                  p.destacado
                    ? "border-[#f5c518] bg-white shadow-xl shadow-amber-500/10 dark:border-[#f5c518] dark:bg-slate-900"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                {p.destacado ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#1e293b] px-3 py-1 text-xs font-semibold text-[#f5c518]">
                    Más popular
                  </span>
                ) : null}
                <h3 className="text-lg font-semibold">{p.nombre}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{p.para}</p>
                <div className="mt-5">
                  <span className="text-4xl font-extrabold tracking-tight">{p.precio}</span>
                  {p.periodo ? <span className="text-sm text-slate-500 dark:text-slate-400"> {p.periodo}</span> : null}
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {p.incluye.map((i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <IconCheck />
                      <span className="text-slate-700 dark:text-slate-300">{i}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.cta === "Contáctanos" ? "#contacto" : "/login"}
                  className={`mt-7 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                    p.destacado
                      ? "bg-[#f5c518] text-slate-900 hover:bg-[#eab308]"
                      : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">
            Los precios son referenciales y pueden ajustarse a tu operación.
          </p>
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" className="border-t border-slate-100 bg-slate-50 py-20 dark:border-slate-900 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 lg:grid-cols-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wide text-amber-600">Contacto</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Hablemos de tu operación</h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              ¿Quieres una demostración o dar de alta tu empresa? Escríbenos y te contactamos.
            </p>
            <ul className="mt-6 space-y-4 text-sm">
              <li className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><IconMail /></span>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Correo</p>
                  <a href="mailto:contacto@rifax.co" className="text-slate-500 hover:text-amber-600 dark:text-slate-400">contacto@rifax.co</a>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><IconPhone /></span>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">WhatsApp</p>
                  <p className="text-slate-500 dark:text-slate-400">+57 300 000 0000</p>
                </div>
              </li>
            </ul>
          </div>

          <form
            action="mailto:contacto@rifax.co"
            method="post"
            encType="text/plain"
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="c_nombre" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
                <input id="c_nombre" name="nombre" required className={inputCls} />
              </div>
              <div>
                <label htmlFor="c_empresa" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Empresa</label>
                <input id="c_empresa" name="empresa" className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor="c_correo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Correo</label>
              <input id="c_correo" name="correo" type="email" required className={inputCls} />
            </div>
            <div>
              <label htmlFor="c_msg" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Mensaje</label>
              <textarea id="c_msg" name="mensaje" rows={4} className={inputCls} />
            </div>
            <button type="submit" className="w-full rounded-lg bg-[#f5c518] px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-[#eab308]">
              Enviar mensaje
            </button>
          </form>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-3xl bg-[#1e293b] px-8 py-14 text-center shadow-xl shadow-slate-900/20">
            <h2 className="text-3xl font-bold tracking-tight text-white">Empieza a gestionar tus rifas hoy</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-300">
              Accede a la plataforma con las credenciales de tu empresa.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex rounded-lg bg-[#f5c518] px-6 py-3 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-[#eab308]"
            >
              Ingresar →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 py-10 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 sm:flex-row dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1e293b] text-xs font-black text-[#f5c518]">R</div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">RIFAX</span>
          </div>
          <p>© {new Date().getFullYear()} RIFAX. Plataforma multi-empresa de gestión de rifas.</p>
          <p className="text-xs">Next.js · Prisma · Neon</p>
        </div>
      </footer>
    </div>
  );
}

function Stat({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <IconCheck />
      <span className="font-semibold text-slate-700 dark:text-slate-200">{valor}</span>
      <span>{etiqueta}</span>
    </span>
  );
}

/* --- Íconos (SVG inline) --- */
function IconCheck() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  );
}
function IconTicket() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v14" /></svg>;
}
function IconCart() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>;
}
function IconWallet() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" /><path d="M16 12h.01" /></svg>;
}
function IconShield() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
}
function IconBuildings() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4M10 10h4M10 14h4" /></svg>;
}
function IconLock() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
}
function IconMail() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>;
}
function IconPhone() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>;
}
