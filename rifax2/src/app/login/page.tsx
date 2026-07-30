import { getLoginFondo } from "@/lib/plataforma";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const fondo = await getLoginFondo();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950">
      {/* Fondo configurable: imagen que se ajusta a la pantalla + degradado. */}
      {fondo ? (
        <>
          <div
            className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${fondo})` }}
          />
          <div className="fixed inset-0 -z-10 bg-gradient-to-br from-white/80 via-white/70 to-white/90 dark:from-slate-950/85 dark:via-slate-950/75 dark:to-slate-950/92" />
        </>
      ) : null}

      <LoginForm />
    </main>
  );
}
