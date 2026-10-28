/**
 * Mensajes variados cuando la IA no entiende el mensaje del usuario.
 * Se diferencia entre texto e imagen porque las sugerencias cambian.
 */

export const FALLBACKS_TEXTO: string[] = [
  '🤔 No entendí ese mensaje. Probá con "Gasté 1500 en el super".',
  '😅 Se me escapó la intención. Ejemplo: "Pagué 800 de nafta".',
  '🙈 No pude interpretar el gasto. Contame algo como "Café 350".',
  '🤷 Todavía no sé qué hacer con eso. Probá "Gasté 200 en el colectivo".',
  '📝 Escribilo con un monto, por ejemplo: "Super 4200".',
  '🤖 Necesito un monto para registrar el gasto, ej: "$1500 en el Coto".',
  '❓ No logré detectar un gasto. Ejemplo: "Cena 2500".',
  '💡 Podés pedirme un resumen: "¿cuánto gasté este mes?".',
  '🧐 No reconocí la intención. Ejemplo: "Farmacia 1200".',
  '✍️ Contame el gasto con número incluido, ej: "Sube 900".',
];

export const FALLBACKS_IMAGEN: string[] = [
  '📷 No pude leer ese ticket. Probá con más luz y foco.',
  '🔍 La imagen no mostró un gasto claro. Acercate un poco más.',
  '🧾 No detecté montos en la foto. Enviá el ticket completo.',
  '🤔 La foto salió borrosa. Probá de nuevo con mejor luz.',
  '📸 Subí una foto nítida del comprobante para analizarlo.',
  '😕 No encontré datos de compra en la imagen. Reintentá.',
  '🔦 El ticket se ve muy oscuro. Sacá otra foto con luz.',
  '✂️ La imagen está recortada. Que se vea el total del ticket.',
  '🖼️ No pude interpretar la imagen. Probá con otro ángulo.',
  '🧐 La foto no es legible. Enviá el comprobante más de cerca.',
];

/** Elige un mensaje pseudoaleatorio de un pool no vacío. */
export function elegirMensaje(
  pool: string[],
  aleatorio: number = Math.random(),
): string {
  const indice = Math.floor(aleatorio * pool.length);
  return pool[Math.min(Math.max(indice, 0), pool.length - 1)] ?? '';
}

export function mensajeNoEntendidoTexto(aleatorio?: number): string {
  return elegirMensaje(FALLBACKS_TEXTO, aleatorio);
}

export function mensajeNoEntendidoImagen(aleatorio?: number): string {
  return elegirMensaje(FALLBACKS_IMAGEN, aleatorio);
}
