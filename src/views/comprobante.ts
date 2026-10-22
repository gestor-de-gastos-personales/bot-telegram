/**
 * Mensajes del flujo de análisis de comprobantes por imagen.
 */
export const MENSAJE_ANALIZANDO =
  '🧾 Analizando tu comprobante, un momento...';

export const MENSAJE_IMAGEN_ILEGIBLE =
  '⚠️ No pude leer la imagen enviada. Probá de nuevo.';

export function mensajeErrorComprobante(detalle: string): string {
  return `⚠️ ${detalle}`;
}
