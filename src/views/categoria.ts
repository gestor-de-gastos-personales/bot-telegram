/**
 * Mensajes del flujo de creación de categorías desde Telegram.
 */

export const MENSAJE_CATEGORIA_INVALIDA =
  '⚠️ Necesito un nombre de al menos 2 letras. Ejemplo: /categoria Gimnasio';

export function mensajeUsoCategoria(): string {
  return '🏷️ Usá: /categoria Nombre de la categoría\nEjemplo: /categoria Gimnasio';
}

export function mensajeCategoriaCreada(nombre: string): string {
  return `✅ Categoría <b>${nombre}</b> creada correctamente. Ya podés usarla en tus gastos.`;
}

export function mensajeErrorCategoria(detalle: string): string {
  return `❌ No se pudo crear la categoría:\n${detalle}`;
}
