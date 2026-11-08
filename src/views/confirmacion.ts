/**
 * Mensajes posteriores a la confirmación o cancelación de un gasto.
 */
export const MENSAJE_GASTO_GUARDADO = [
  '✅ <b>¡Gasto guardado!</b>',
  '',
  'Ya lo sumé a tus gastos. 📊',
].join('\n');

export const MENSAJE_SIN_PENDIENTE = [
  '🤷 <b>No hay ningún gasto pendiente</b>',
  '',
  'Mandame el gasto como texto y lo registro.',
].join('\n');

export const MENSAJE_CANCELADO = [
  '🚫 <b>Cancelado</b>',
  '',
  'No guardé nada. Cuando quieras, mandame el gasto.',
].join('\n');

export function mensajeErrorGuardado(detalle: string): string {
  return [
    '❌ <b>No pude guardar el gasto</b>',
    '',
    'El servicio de gastos no está respondiendo. Probá de nuevo en un momento.',
    '',
    `<i>Detalle: ${detalle}</i>`,
  ].join('\n');
}
