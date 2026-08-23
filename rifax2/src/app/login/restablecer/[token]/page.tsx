// Página envoltorio de servidor: solo existe para forzar renderizado
// dinámico. Con la CSP por nonce de src/proxy.ts, una página estática no
// lleva el nonce en sus scripts de hidratación y el navegador los bloquea.
export const dynamic = "force-dynamic";

import RestablecerClient from "./restablecer-client";

export default async function RestablecerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RestablecerClient token={token} />;
}
