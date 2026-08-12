// Credenciales de integraciones por empresa: pasarela de pagos (Wompi), API
// de WhatsApp y SMS. Los secretos (llave privada, secreto de eventos, token,
// api key) NUNCA se devuelven al cliente una vez guardados — solo se informa
// si están configurados o no ("••••••••"); para cambiarlos hay que escribir
// un valor nuevo completo (igual que la contraseña del portal de vendedor:
// dejar el campo vacío conserva el valor actual). Guardarlos así (columnas
// de la base de datos) es consistente con cómo ya se guardan otros secretos
// por tenant en esta app, pero no están cifrados en reposo; si se requiere
// ese endurecimiento adicional, es un cambio aparte (cifrado a nivel de
// aplicación con una clave de entorno).
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { mensajeError } from "@/lib/errores";

type Resultado = { ok: true } | { ok: false; error: string };

export interface IntegracionesUI {
  wompiSandbox: boolean;
  wompiPublicKey: string | null;
  wompiPrivateKeyConfigurada: boolean;
  wompiEventsSecretConfigurado: boolean;
  whatsappPhoneNumberId: string | null;
  whatsappTokenConfigurado: boolean;
  smsRemitente: string | null;
  smsApiKeyConfigurada: boolean;
}

export interface CredencialesWompi {
  sandbox: boolean;
  publicKey: string;
  privateKey: string;
  eventsSecret: string;
}

// Únicamente para uso interno del flujo de pago (construir el checkout,
// verificar el checksum del webhook) — a diferencia de `obtenerIntegraciones`,
// esta SÍ devuelve los secretos en claro. Nunca debe llegar a un componente
// cliente ni a una respuesta HTTP directamente.
export async function obtenerCredencialesWompi(tenantId: bigint): Promise<CredencialesWompi | null> {
  const fila = await prisma.tenant_integraciones.findUnique({ where: { tenant_id: tenantId } });
  if (!fila?.wompi_public_key || !fila.wompi_private_key || !fila.wompi_events_secret) return null;
  return { sandbox: fila.wompi_sandbox, publicKey: fila.wompi_public_key, privateKey: fila.wompi_private_key, eventsSecret: fila.wompi_events_secret };
}

export async function obtenerIntegraciones(tenantId: bigint): Promise<IntegracionesUI> {
  const fila = await prisma.tenant_integraciones.findUnique({ where: { tenant_id: tenantId } });
  return {
    wompiSandbox: fila?.wompi_sandbox ?? true,
    wompiPublicKey: fila?.wompi_public_key ?? null,
    wompiPrivateKeyConfigurada: !!fila?.wompi_private_key,
    wompiEventsSecretConfigurado: !!fila?.wompi_events_secret,
    whatsappPhoneNumberId: fila?.whatsapp_phone_number_id ?? null,
    whatsappTokenConfigurado: !!fila?.whatsapp_token,
    smsRemitente: fila?.sms_remitente ?? null,
    smsApiKeyConfigurada: !!fila?.sms_api_key,
  };
}

export const guardarIntegracionesSchema = z.object({
  // Booleano ya resuelto por la acción (los checkboxes de formulario no
  // envían nada cuando están destildados, así que no se puede confiar en
  // z.coerce.boolean() sobre el valor crudo del FormData).
  wompi_sandbox: z.boolean().default(true),
  wompi_public_key: z.string().trim().optional(),
  wompi_private_key: z.string().trim().optional(),
  wompi_events_secret: z.string().trim().optional(),
  whatsapp_phone_number_id: z.string().trim().optional(),
  whatsapp_token: z.string().trim().optional(),
  sms_remitente: z.string().trim().optional(),
  sms_api_key: z.string().trim().optional(),
});

// Campos NO sensibles: se reemplazan tal cual (incluido vaciarlos si llegan
// en blanco). Campos sensibles: un valor en blanco significa "no cambiar",
// nunca "borrar" (para borrar uno explícitamente habría que agregar un botón
// aparte, a propósito, para que no se pierda una credencial por accidente).
export async function guardarIntegraciones(tenantId: bigint, input: unknown, actorId: bigint): Promise<Resultado> {
  const parsed = guardarIntegracionesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const actual = await tx.tenant_integraciones.findUnique({ where: { tenant_id: tenantId } });
      await tx.tenant_integraciones.upsert({
        where: { tenant_id: tenantId },
        create: {
          tenant_id: tenantId,
          wompi_sandbox: d.wompi_sandbox,
          wompi_public_key: d.wompi_public_key || null,
          wompi_private_key: d.wompi_private_key || null,
          wompi_events_secret: d.wompi_events_secret || null,
          whatsapp_phone_number_id: d.whatsapp_phone_number_id || null,
          whatsapp_token: d.whatsapp_token || null,
          sms_remitente: d.sms_remitente || null,
          sms_api_key: d.sms_api_key || null,
        },
        update: {
          wompi_sandbox: d.wompi_sandbox,
          wompi_public_key: d.wompi_public_key || null,
          whatsapp_phone_number_id: d.whatsapp_phone_number_id || null,
          sms_remitente: d.sms_remitente || null,
          ...(d.wompi_private_key ? { wompi_private_key: d.wompi_private_key } : {}),
          ...(d.wompi_events_secret ? { wompi_events_secret: d.wompi_events_secret } : {}),
          ...(d.whatsapp_token ? { whatsapp_token: d.whatsapp_token } : {}),
          ...(d.sms_api_key ? { sms_api_key: d.sms_api_key } : {}),
          actualizado_en: new Date(),
        },
      });
      // Nunca se auditan los valores de los secretos, solo qué campos cambiaron.
      await auditar(tx, {
        tenantId, actorId, accion: "tenant.integraciones_editar", entidadTipo: "tenant", entidadId: tenantId,
        despues: {
          wompi_sandbox: d.wompi_sandbox,
          wompi_public_key_cambiado: d.wompi_public_key !== (actual?.wompi_public_key ?? ""),
          wompi_private_key_cambiada: !!d.wompi_private_key,
          wompi_events_secret_cambiado: !!d.wompi_events_secret,
          whatsapp_token_cambiado: !!d.whatsapp_token,
          sms_api_key_cambiada: !!d.sms_api_key,
        },
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeError(e, "Error al guardar las integraciones.") };
  }
}
