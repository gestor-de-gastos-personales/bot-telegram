import { InlineKeyboard } from 'grammy';
import type { GastoAnalizado } from '../services/ia.service.js';
import type { CampoEditable } from '../edicion.js';
import { escapeHtml } from '../utils/format.js';

export const MENSAJE_GASTO_INVALIDO =
  '🤖 No pude identificar un gasto válido. Ejemplo: "Gasté 200 en un colectivo"';

export const MENSAJE_EDITAR = '✏️ <b>¿Qué querés editar?</b>';

const PREGUNTAS_EDICION: Record<CampoEditable, string> = {
  monto: '💰 Escribí el nuevo monto (ej: 1500 o $1.500,50):',
  descripcion: '📝 Escribí la nueva descripción:',
  categoria: '🏷️ Escribí la nueva categoría (ej: Alimentación):',
};

/** Muestra la fecha ISO como DD/MM/YYYY; sin fecha asume el día actual. */
export function formatearFechaGasto(fecha: string | null): string {
  if (!fecha) return 'hoy';

  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

export function mensajePedirCampo(campo: CampoEditable): string {
  return PREGUNTAS_EDICION[campo];
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
    '¿Deseas guardar este registro?',
  ].join('\n');
}

/**
 * Botones para confirmar, editar o descartar el gasto pendiente.
 */
export function tecladoConfirmacion(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Confirmar', 'confirm_gasto')
    .text('✏️ Editar', 'edit_gasto')
    .row()
    .text('❌ Cancelar', 'cancel_gasto');
}

/** Opciones del menú de edición del gasto pendiente. */
export function tecladoEdicion(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💰 Monto', 'edit_monto')
    .text('📝 Descripción', 'edit_descripcion')
    .text('🏷️ Categoría', 'edit_categoria')
    .row()
    .text('↩️ Volver', 'edit_volver');
}

/** Botón para abandonar la edición sin perder el gasto pendiente. */
export function tecladoVolver(): InlineKeyboard {
  return new InlineKeyboard().text('↩️ Volver', 'edit_volver');
}
