"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const correo = String(formData.get("correo") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!correo || !password) {
    return { error: "Ingresa correo y contraseña." };
  }

  const usuario = await prisma.usuarios.findUnique({
    where: { correo },
    include: { roles: true },
  });

  // Mensaje genérico para no revelar si el correo existe.
  if (!usuario || usuario.estado !== "activo") {
    return { error: "Credenciales inválidas." };
  }

  const ok = await verifyPassword(password, usuario.password_hash);
  if (!ok) {
    return { error: "Credenciales inválidas." };
  }

  await createSession({
    id: usuario.id,
    uuid: usuario.uuid,
    rolNombre: usuario.roles.nombre,
  });
  await prisma.usuarios.update({
    where: { id: usuario.id },
    data: { ultimo_login: new Date() },
  });

  redirect("/admin");
}
