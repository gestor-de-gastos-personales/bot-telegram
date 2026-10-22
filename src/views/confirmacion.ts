/**
 * Mensajes posteriores a la confirmación o cancelación de un gasto.
 */
export const MENSAJE_GASTO_GUARDADO =
  '✅ ¡Gasto registrado e impactado en tu cuenta con éxito!';

export const MENSAJE_SIN_PENDIENTE =
  '⚠️ No hay ningún gasto pendiente por confirmar.';

export const MENSAJE_CANCELADO = '🚫 Registro cancelado.';

export function mensajeErrorGuardado(detalle: string): string {
  return `❌ No se pudo guardar el gasto en api-gastos:\n${detalle}`;
}
