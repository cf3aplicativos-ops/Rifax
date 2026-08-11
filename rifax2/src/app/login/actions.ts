"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSuperSession, createUserSession } from "@/lib/auth/session";
import { permitir, reiniciar } from "@/lib/rate-limit";

export interface LoginState {
  error?: string;
}

// Fuerza bruta: como máximo 10 intentos por (IP, correo) cada 15 minutos.
const LIMITE_INTENTOS = 10;
const VENTANA_MS = 15 * 60 * 1000;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const correo = String(formData.get("correo") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!correo || !password) return { error: "Ingresa correo y contraseña." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  const claveIntentos = `login:${ip}:${correo.toLowerCase()}`;
  if (!permitir(claveIntentos, LIMITE_INTENTOS, VENTANA_MS)) {
    return { error: "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo." };
  }

  // 1) ¿Super-admin de plataforma?
  const superAdmin = await prisma.plataforma_admins.findUnique({ where: { correo } });
  if (superAdmin && superAdmin.estado === "activo") {
    if (await verifyPassword(password, superAdmin.password_hash)) {
      reiniciar(claveIntentos);
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
    reiniciar(claveIntentos);
    await createUserSession({ id: usuario.id, uuid: usuario.uuid });
    await prisma.usuarios.update({ where: { id: usuario.id }, data: { ultimo_login: new Date() } });
    // Los vendedores van a su portal móvil; los demás roles, al panel.
    redirect(usuario.roles.nombre === "vendedor" ? "/vendedor" : "/app");
  }

  return { error: "Credenciales inválidas." };
}
