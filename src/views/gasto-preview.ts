import { InlineKeyboard } from 'grammy';
import type { GastoAnalizado } from '../services/ia.service.js';
import { escapeHtml } from '../utils/format.js';

export const MENSAJE_GASTO_INVALIDO =
  '🤖 No pude identificar un gasto válido. Ejemplo: "Gasté 200 en un colectivo"';

/** Pista que acompaña a la vista previa para corregir por texto. */
export const PISTA_EDICION =
  '💡 Si algo no está bien, escribime por ejemplo "el precio es 2500".';

/** Muestra la fecha ISO como DD/MM/YYYY; sin fecha asume el día actual. */
export function formatearFechaGasto(fecha: string | null): string {
  if (!fecha) return 'hoy';

  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
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
    `📅 <b>Fecha:</b> ${formatearFechaGasto(gasto.fecha)}`,
    '',
    PISTA_EDICION,
    '',
    '¿Deseas guardar este registro?',
  ].join('\n');
}

export function construirVistaPreviaRecurrente(gasto: GastoAnalizado): string {
  return [
    '📊 <b>Vista previa del gasto</b>',
    '',
    `💰 <b>Monto:</b> $${gasto.monto ?? '-'}`,
    `🏪 <b>Comercio:</b> ${escapeHtml(gasto.comercio ?? '-')}`,
    `🏷️ <b>Categoría:</b> ${escapeHtml(gasto.categoria ?? 'Varios')}`,
    `📝 <b>Descripción:</b> ${escapeHtml(gasto.descripcion ?? '-')}`,
    `📅 <b>Fecha:</b> ${formatearFechaGasto(gasto.fecha)}`,
    '',
    '⏰ <b>Se registrará cada:</b> por definir',
    '',
    PISTA_EDICION,
    '',
    '¿Deseas guardar este registro?',
  ].join('\n');
}

/**
 * Botones para confirmar o descartar el gasto pendiente.
 */
export function tecladoConfirmacion(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Confirmar', 'confirm_gasto')
    .text('❌ Cancelar', 'cancel_gasto');
}
