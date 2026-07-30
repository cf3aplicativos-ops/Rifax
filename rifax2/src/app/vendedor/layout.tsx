import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import MenuVendedor from "./menu";

export default async function VendedorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Solo para rol vendedor; otros roles usan el panel /app.
  if (user.rol !== "vendedor") redirect("/app");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <MenuVendedor tenant={user.tenant.nombre} nombre={user.nombre} />
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
