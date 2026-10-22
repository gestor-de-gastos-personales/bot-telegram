import { InlineKeyboard } from 'grammy';
import type { GastoAnalizado } from '../services/ia.service.js';
import { escapeHtml } from '../utils/format.js';

export const MENSAJE_GASTO_INVALIDO =
  '🤖 No pude identificar un gasto válido. Ejemplo: "Gasté 200 en un colectivo"';

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
 * Botones para confirmar o descartar el gasto pendiente.
 */
export function tecladoConfirmacion(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Confirmar y Guardar', 'confirm_gasto')
    .text('❌ Cancelar', 'cancel_gasto');
}
