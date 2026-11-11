/**
 * Mensajes del flujo de análisis de comprobantes por imagen.
 */
export const MENSAJE_ANALIZANDO = [
  '🧾 <b>Leyendo tu comprobante</b>',
  '',
  ' Dame un segundo...',
].join('\n');

export const MENSAJE_IMAGEN_ILEGIBLE = [
  '🤔 <b>No pude leer la imagen</b>',
  '',
  'Probá con una foto más nítida, con el ticket completo y sin flashes.',
].join('\n');

export function mensajeErrorComprobante(detalle: string): string {
  return [
    '❌ <b>No pude procesar el comprobante</b>',
    '',
    'El servicio de imágenes no está respondiendo. Probá de nuevo en un momento.',
    '',
    `<i>Detalle: ${detalle}</i>`,
  ].join('\n');
}
