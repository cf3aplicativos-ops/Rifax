import Image from "next/image";
import { PageTitle } from "@/components/icons";
import { requirePermission } from "@/lib/auth/rbac";
import { listarCatalogos, TIPOS } from "@/lib/catalogos";
import { getBranding } from "@/lib/branding";
import { obtenerIntegraciones } from "@/lib/integraciones";
import PasswordInput from "@/components/PasswordInput";
import { agregarItemAction, toggleItemAction, guardarBrandingAction, guardarDominioAction, guardarIntegracionesAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConfigPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requirePermission("config.gestionar");
  const sp = await searchParams;
  const [porTipo, branding, integraciones] = await Promise.all([
    listarCatalogos(user.tenant.id),
    getBranding(user.tenant.id),
    obtenerIntegraciones(user.tenant.id),
  ]);

  return (
    <div>
      <PageTitle icon="config">Configuración</PageTitle>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Personaliza las listas desplegables del aplicativo. Si no agregas opciones, se usan las
        predeterminadas.
      </p>

      {sp.ok ? <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Guardado.</p> : null}
      {sp.error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{sp.error}</p> : null}

      {/* BRANDING (#6) */}
      <section className="mt-6 rounded-xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Marca (logo, fondo y color)</h2>
        <form action={guardarBrandingAction} className="mt-3 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">Logo <span className="text-slate-400">(PNG/JPG/WEBP/SVG, ≤400KB)</span></label>
              {branding.logoUrl ? (
                <div className="mb-2 flex items-center gap-3">
                  <Image src={branding.logoUrl} alt="logo" width={40} height={40} unoptimized className="h-10 w-10 rounded object-contain" />
                  <label className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><input type="checkbox" name="quitar_logo" /> quitar</label>
                </div>
              ) : null}
              <input type="file" name="logo" accept="image/*" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 dark:text-slate-400 dark:file:bg-indigo-950 dark:file:text-indigo-300" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">Imagen de fondo <span className="text-slate-400">(≤1.5MB)</span></label>
              {branding.fondoUrl ? (
                <label className="mb-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><input type="checkbox" name="quitar_fondo" /> quitar fondo actual</label>
              ) : null}
              <input type="file" name="fondo" accept="image/*" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 dark:text-slate-400 dark:file:bg-indigo-950 dark:file:text-indigo-300" />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">Color primario</label>
              <input type="color" name="color" defaultValue={branding.colorPrimario} className="h-9 w-16 rounded border border-slate-300 dark:border-slate-700" />
            </div>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Guardar marca</button>
          </div>
        </form>
      </section>

      {/* LANDING PÚBLICA Y DOMINIO PROPIO (#4a / #4b) */}
      <section id="dominio" className="mt-6 rounded-xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Landing pública y dominio propio</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Tu empresa ya tiene una página pública con tus rifas activas y compra en línea, con la marca de arriba:
        </p>
        <a
          href={`/e/${user.tenant.slug}`} target="_blank" rel="noreferrer"
          className="mt-2 inline-block rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-sm text-indigo-600 hover:underline dark:bg-slate-800 dark:text-indigo-400"
        >
          rifax2.vercel.app/e/{user.tenant.slug} ↗
        </a>

        <form action={guardarDominioAction} className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div>
            <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">Tu dominio propio <span className="text-slate-400">(opcional, ej: rifasjuan.com)</span></label>
            <input name="dominio" defaultValue={branding.dominioPersonalizado ?? ""} placeholder="rifasjuan.com" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
          </div>
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Guardar dominio</button>
        </form>

        {branding.dominioPersonalizado ? (
          <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <p className="font-semibold">Pasos para activar {branding.dominioPersonalizado}:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
              <li>En el proveedor donde compraste el dominio, crea un registro <strong>CNAME</strong> que apunte <span className="font-mono">{branding.dominioPersonalizado}</span> a <span className="font-mono">cname.vercel-dns.com</span> (si es el dominio raíz sin &quot;www&quot;, usa un registro <strong>A</strong> hacia <span className="font-mono">76.76.21.21</span>).</li>
              <li>Los cambios de DNS pueden tardar desde minutos hasta un par de horas en propagarse.</li>
              <li><strong>Paso final pendiente:</strong> avísanos cuando el DNS esté configurado — el dominio todavía no queda conectado automáticamente al sitio; falta agregarlo del lado de la plataforma (Vercel) una sola vez.</li>
            </ol>
          </div>
        ) : null}
      </section>

      {/* INTEGRACIONES (#7): pasarela de pagos, WhatsApp y SMS */}
      <section id="integraciones" className="mt-6 rounded-xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Integraciones (pasarela de pagos, WhatsApp y SMS)</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Las credenciales sensibles no se vuelven a mostrar una vez guardadas. Deja el campo en blanco para
          conservar el valor actual; escribe uno nuevo para reemplazarlo.
        </p>
        <form action={guardarIntegracionesAction} className="mt-4 space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-700 dark:text-slate-300">Wompi (pasarela de pagos)</legend>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" name="wompi_sandbox" defaultChecked={integraciones.wompiSandbox} className="rounded" />
              Modo de pruebas (sandbox) — desactiva cuando tengas las llaves de producción de Wompi
            </label>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Llave pública</label>
              <input name="wompi_public_key" defaultValue={integraciones.wompiPublicKey ?? ""} placeholder="pub_..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Llave privada {integraciones.wompiPrivateKeyConfigurada ? <span className="text-emerald-600 dark:text-emerald-400">(configurada)</span> : <span className="text-slate-400">(sin configurar)</span>}
                </label>
                <PasswordInput name="wompi_private_key" required={false} autoComplete="off" placeholder={integraciones.wompiPrivateKeyConfigurada ? "•••••••• (dejar en blanco para no cambiar)" : "prv_..."} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Secreto de eventos (webhook) {integraciones.wompiEventsSecretConfigurado ? <span className="text-emerald-600 dark:text-emerald-400">(configurado)</span> : <span className="text-slate-400">(sin configurar)</span>}
                </label>
                <PasswordInput name="wompi_events_secret" required={false} autoComplete="off" placeholder={integraciones.wompiEventsSecretConfigurado ? "•••••••• (dejar en blanco para no cambiar)" : "eventos secretos"} />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <legend className="text-sm font-semibold text-slate-700 dark:text-slate-300">API de WhatsApp</legend>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">ID del número de teléfono</label>
              <input name="whatsapp_phone_number_id" defaultValue={integraciones.whatsappPhoneNumberId ?? ""} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Token de acceso {integraciones.whatsappTokenConfigurado ? <span className="text-emerald-600 dark:text-emerald-400">(configurado)</span> : <span className="text-slate-400">(sin configurar)</span>}
              </label>
              <PasswordInput name="whatsapp_token" required={false} autoComplete="off" placeholder={integraciones.whatsappTokenConfigurado ? "•••••••• (dejar en blanco para no cambiar)" : "token"} />
            </div>
          </fieldset>

          <fieldset className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <legend className="text-sm font-semibold text-slate-700 dark:text-slate-300">SMS</legend>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Remitente</label>
              <input name="sms_remitente" defaultValue={integraciones.smsRemitente ?? ""} placeholder="Nombre o número remitente" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                API key {integraciones.smsApiKeyConfigurada ? <span className="text-emerald-600 dark:text-emerald-400">(configurada)</span> : <span className="text-slate-400">(sin configurar)</span>}
              </label>
              <PasswordInput name="sms_api_key" required={false} autoComplete="off" placeholder={integraciones.smsApiKeyConfigurada ? "•••••••• (dejar en blanco para no cambiar)" : "api key"} />
            </div>
          </fieldset>

          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Guardar integraciones</button>
        </form>
      </section>

      <div className="mt-6 space-y-6">
        {TIPOS.map((t) => {
          const items = porTipo.get(t.tipo) ?? [];
          const usaDefaults = items.length === 0;
          return (
            <section key={t.tipo} className="rounded-xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t.titulo}</h2>

              <div className="mt-3 space-y-1.5">
                {usaDefaults ? (
                  t.defaults.map((d) => (
                    <div key={d.valor} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-800/50">
                      <span className="text-slate-700 dark:text-slate-300">{d.etiqueta} <span className="font-mono text-xs text-slate-400">({d.valor})</span></span>
                      <span className="text-xs text-slate-400">predeterminado</span>
                    </div>
                  ))
                ) : (
                  items.map((it) => (
                    <div key={String(it.id)} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-800/50">
                      <span className={it.activo ? "text-slate-700 dark:text-slate-300" : "text-slate-400 line-through"}>
                        {it.etiqueta} <span className="font-mono text-xs text-slate-400">({it.valor})</span>
                      </span>
                      <form action={toggleItemAction}>
                        <input type="hidden" name="id" value={String(it.id)} />
                        <button type="submit" className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                          {it.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  ))
                )}
              </div>

              <form action={agregarItemAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                <input type="hidden" name="tipo" value={t.tipo} />
                <input name="etiqueta" required placeholder="Etiqueta (visible)" className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                <input name="valor" required placeholder="valor_interno" className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-700">Agregar</button>
              </form>
              {usaDefaults ? <p className="mt-2 text-xs text-slate-400">Al agregar la primera opción, esta lista deja de usar los predeterminados.</p> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
