"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth/rbac";
import { crearSlide, eliminarSlide, toggleSlide } from "@/lib/plataforma";

const back = (qs: string) => redirect(`/panel/carrusel?${qs}`);

export async function crearSlideAction(formData: FormData): Promise<void> {
  await requireSuper();
  const imagen = formData.get("imagen");
  const res = await crearSlide({
    imagen: imagen instanceof File ? imagen : null,
    titulo: String(formData.get("titulo") ?? ""),
    subtitulo: String(formData.get("subtitulo") ?? ""),
    orden: Number(formData.get("orden") ?? 0),
  });
  revalidatePath("/panel/carrusel");
  revalidatePath("/");
  back(res.ok ? "creado=1" : `error=${encodeURIComponent(res.error)}`);
}

export async function eliminarSlideAction(formData: FormData): Promise<void> {
  await requireSuper();
  await eliminarSlide(BigInt(String(formData.get("id") ?? "0")));
  revalidatePath("/panel/carrusel");
  revalidatePath("/");
  back("eliminado=1");
}

export async function toggleSlideAction(formData: FormData): Promise<void> {
  await requireSuper();
  await toggleSlide(BigInt(String(formData.get("id") ?? "0")));
  revalidatePath("/panel/carrusel");
  revalidatePath("/");
  back("estado=1");
}
