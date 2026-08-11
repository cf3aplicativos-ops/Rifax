import { getConfigPlataforma } from "@/lib/plataforma";
import FormNuevoTenant from "./form";

export default async function NuevoTenantPage() {
  const config = await getConfigPlataforma();
  return <FormNuevoTenant sedesBasico={config.sedesBasico} sedesCorporativo={config.sedesCorporativo} />;
}
