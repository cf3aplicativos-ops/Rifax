"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSuperSession, createUserSession } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const correo = String(formData.get("correo") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!correo || !password) return { error: "Ingresa correo y contraseña." };

  // 1) ¿Super-admin de plataforma?
  const superAdmin = await prisma.plataforma_admins.findUnique({ where: { correo } });
  if (superAdmin && superAdmin.estado === "activo") {
    if (await verifyPassword(password, superAdmin.password_hash)) {
      await createSuperSession({ uuid: superAdmin.uuid });
      await prisma.plataforma_admins.update({
        where: { id: superAdmin.id },
        data: { ultimo_login: new Date() },
      });
      redirect("/panel");
    }
    return { error: "Credenciales inválidas." };
  }

  // 2) ¿Usuario de un tenant? (el correo es único por tenant)
  const usuario = await prisma.usuarios.findFirst({
    where: { correo, estado: "activo" },
    include: { tenants: true, roles: { select: { nombre: true } } },
  });
  if (usuario && (await verifyPassword(password, usuario.password_hash))) {
    if (usuario.tenants.estado !== "activo") {
      return { error: "La cuenta de tu empresa está suspendida. Contacta al administrador." };
    }
    await createUserSession({ id: usuario.id, uuid: usuario.uuid });
    await prisma.usuarios.update({ where: { id: usuario.id }, data: { ultimo_login: new Date() } });
    // Los vendedores van a su portal móvil; los demás roles, al panel.
    redirect(usuario.roles.nombre === "vendedor" ? "/vendedor" : "/app");
  }

  return { error: "Credenciales inválidas." };
}
