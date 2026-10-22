import type { GastoAnalizado } from '../services/ia.service.js';

/**
 * Escapa los caracteres reservados de HTML para que Telegram no rechace
 * el mensaje con un error de "can't parse entities".
 */
export function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Arma la vista previa del gasto con el formato que renderiza Telegram.
 */
export function construirVistaPrevia(gasto: GastoAnalizado): string {
  return [
    '📊 <b>Vista previa del gasto</b>',
    '',
    `💰 <b>Monto:</b> $${gasto.monto ?? '-'}`,
    `🏪 <b>Comercio:</b> ${escapeHtml(gasto.comercio ?? '-')}`,
    `🏷️ <b>Categoría:</b> ${escapeHtml(gasto.categoria ?? 'Varios')}`,
    `📝 <b>Descripción:</b> ${escapeHtml(gasto.descripcion ?? '-')}`,
    '',
    '¿Deseas guardar este registro?',
  ].join('\n');
}

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
