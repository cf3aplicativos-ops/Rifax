// Normaliza errores inesperados (Prisma/pg) antes de devolverlos al cliente.
// Nunca reenvía el mensaje crudo de la base de datos (puede filtrar nombres de
// tablas/columnas, restricciones o fragmentos de SQL): siempre se registra el
// error real en el servidor (para diagnóstico) y se devuelve un mensaje
// genérico y ya conocido por quien llama.
import "server-only";

export function mensajeError(e: unknown, generico: string): string {
  console.error(generico, e);
  return generico;
}
