/**
 * Mensajes del flujo de creación de categorías desde Telegram.
 */

export const MENSAJE_CATEGORIA_INVALIDA = [
  '🤔 <b>El nombre de la categoría es muy corto</b>',
  '',
  'Necesito al menos 2 letras. Ej: <code>/categoria Gimnasio</code>',
].join('\n');

export function mensajeUsoCategoria(): string {
  return [
    '🏷️ <b>Crear una categoría</b>',
    '',
    'Escribí: <code>/categoria Nombre</code>',
    'Ej: <code>/categoria Gimnasio</code>',
  ].join('\n');
}

export function mensajeCategoriaCreada(nombre: string): string {
  return [
    '✅ <b>Categoría creada</b>',
    '',
    `Ya podés usar <b>${nombre}</b> en tus gastos. 🎉`,
  ].join('\n');
}

export function mensajeErrorCategoria(detalle: string): string {
  return [
    '❌ <b>No pude crear la categoría</b>',
    '',
    'El servicio de categorías no está respondiendo. Probá de nuevo en un momento.',
    '',
    `<i>Detalle: ${detalle}</i>`,
  ].join('\n');
}
