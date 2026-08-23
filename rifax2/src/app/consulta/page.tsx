// Página envoltorio de servidor: fuerza renderizado dinámico y lee el nonce
// de CSP (src/proxy.ts) para pasárselo al <style> del componente cliente —
// una página estática no lleva el nonce y el navegador bloquearía ese tag.
export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import ConsultaClient from "./consulta-client";

export default async function ConsultaPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <ConsultaClient nonce={nonce} />;
}
