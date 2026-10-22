/**
 * Normaliza cualquier error (Error, string, excepción desconocida) a un texto
 * presentable dentro de Telegram.
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Error inesperado';
}

/** Mensaje de error genérico con el prefijo visual del bot. */
export function mensajeErrorGenerico(error: unknown): string {
  return `⚠️ ${mensajeDeError(error)}`;
}
