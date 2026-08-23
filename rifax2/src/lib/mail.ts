// Servicio de correo por SMTP (correo personal, p. ej. Gmail). Runtime Node.
// Config por variables de entorno en Vercel:
//   SMTP_HOST       p. ej. smtp.gmail.com
//   SMTP_PORT       587 (TLS) | 465 (SSL)            (def. 587)
//   SMTP_SECURE     "true" para 465                  (def. false)
//   SMTP_USER       el correo remitente (login)
//   SMTP_PASSWORD   contraseña de aplicación (Gmail: App Password)
//   MAIL_FROM       remitente visible                (def. SMTP_USER)
// Si no está configurado, NO falla: registra el correo en consola (simulado).
import "server-only";
import nodemailer from "nodemailer";

interface SendMailArgs {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendMailArgs): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.MAIL_FROM ?? user ?? "no-reply@rifax.co";

  if (!host || !user || !pass) {
    console.warn("[mail] SMTP no configurado. Correo simulado:", { to, subject });
    return;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  await transporter.sendMail({ from, to, subject, html });
}

// Los valores interpolados (nombre y, sobre todo, password: la fija libremente
// un admin desde el formulario de usuarios/vendedores) llegan a un cuerpo HTML;
// sin escapar, un nombre o contraseña con '<', '>' o '&' rompería el marcado o
// permitiría inyectar contenido en el correo del destinatario.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// El enlace es un token de un solo uso ya armado (host + ruta + token); no
// hay más entrada de usuario que interpolar aquí, así que no necesita escape.
export function mailEnlaceReset(args: { enlace: string }) {
  return {
    subject: "Confirma el restablecimiento de tu contraseña en RIFAX",
    html: `<p>Recibimos una solicitud para restablecer tu contraseña en RIFAX.</p><p>Confirma haciendo clic en este enlace (válido 30 minutos, se puede usar una sola vez):</p><p><a href="${args.enlace}">${args.enlace}</a></p><p>Si no solicitaste este cambio, ignora este correo: tu contraseña actual sigue siendo válida.</p>`,
  };
}

export function mailPasswordTemporal(args: { nombre: string; password: string }) {
  const nombre = escapeHtml(args.nombre);
  const password = escapeHtml(args.password);
  return {
    subject: "Tu contraseña temporal de RIFAX",
    html: `<p>Hola ${nombre},</p><p>Recibimos una solicitud para restablecer tu contraseña en RIFAX. Esta es tu contraseña temporal:</p><p style="font-size:20px;font-weight:bold;letter-spacing:1px;">${password}</p><p>Te pediremos cambiarla apenas ingreses. Si no solicitaste este cambio, ignora este correo o contacta a tu administrador.</p>`,
  };
}

// A diferencia de mailPasswordTemporal (el propio usuario pide "olvidé mi
// contraseña"), esta se envía cuando un administrador le fija una nueva
// contraseña a otra cuenta desde la edición de usuarios/vendedores/sedes.
export function mailPasswordCambiada(args: { nombre: string; password: string }) {
  const nombre = escapeHtml(args.nombre);
  const password = escapeHtml(args.password);
  return {
    subject: "Tu contraseña de acceso a RIFAX fue actualizada",
    html: `<p>Hola ${nombre},</p><p>Un administrador actualizó tu contraseña de acceso a RIFAX. Esta es tu nueva contraseña:</p><p style="font-size:20px;font-weight:bold;letter-spacing:1px;">${password}</p><p>Te pediremos confirmarla apenas ingreses. Si no esperabas este cambio, contacta de inmediato a tu administrador.</p>`,
  };
}
