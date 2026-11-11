import type { RangoResumen } from '../dominio/rango.js';
import { escapeHtml, formatearMonto } from '../utils/format.js';

/** Etiqueta legible de cada rango que devuelve api-gastos. */
export const ETIQUETAS_RANGO: Record<RangoResumen, string> = {
  TODAY: 'hoy',
  WEEK: 'esta semana',
  '15_DAYS': 'los últimos 15 días',
  MONTH: 'este mes',
  '2_MONTHS': 'los últimos 2 meses',
  YEAR: 'este año',
};

/** Mensaje de error cuando el período del gráfico no es válido. */
export const MENSAJE_GRAFICO_INVALIDO = [
  '🤔 <b>No entendí el período del gráfico</b>',
  '',
  'Probá con <code>/grafico hoy|semana|mes|año</code> o <code>/grafico 010126</code>.',
].join('\n');

/** Aviso cuando el rango de fechas está invertido. */
export const AVISO_RANGO_INVERTIDO =
  '↔️ <i>Ajusté el rango: las fechas estaban invertidas.</i>';

/** Mensaje cuando el usuario envía una fecha inválida. */
export const MENSAJE_FECHA_INVALIDA = [
  '🤔 <b>No entendí el período</b>',
  '',
  'Probá con <code>/resumen hoy</code>, <code>/resumen semana</code>, <code>/resumen mes</code>, <code>/resumen año</code>',
  'o un rango de fechas: <code>/resumen 011126 301126</code> (formato DDMMAA).',
].join('\n');

/** Pista sobre qué rangos de resumen están disponibles. */
export const PISTA_RANGO =
  '💡 <i>Períodos: hoy, semana, mes, año o fechas DDMMAA (ej: 011126 301126).</i>';

/** Mensaje cuando el período indicado no se entiende. */
export const MENSAJE_PERIODO_INVALIDO = [
  '🤔 <b>No entendí el período</b>',
  '',
  'Probá con <code>/resumen hoy|semana|mes|año</code> o <code>/resumen 010126</code>.',
].join('\n');

function etiquetaPeriodo(periodo: ResumenPeriodo): string {
  if (periodo.rango) {
    return ETIQUETAS_RANGO[periodo.rango];
  }

  return periodo.mes !== null
    ? `${String(periodo.mes).padStart(2, '0')}/${periodo.anio}`
    : `año ${periodo.anio}`;
}

type ResumenPeriodo = {
  mes: number | null;
  anio: number;
  rango?: RangoResumen | null;
  fechaInicio: string;
  fechaFin: string;
};

/**
 * Renderiza el resumen que devuelve api-gastos, por mes, año o rango flexible.
 */
export function formatearResumen(
  resumen: {
    periodo: ResumenPeriodo;
    totalGeneral: number;
    porCategoria: Array<{
      categoriaNombre: string;
      total: number;
      porcentaje: number;
    }>;
  },
  opciones?: { titulo?: string },
): string {
  const lineas = [
    `📊 <b>${opciones?.titulo ?? `Resumen de ${etiquetaPeriodo(resumen.periodo)}`}</b>`,
    '',
    `💰 <b>Total gastado:</b> ${formatearMonto(resumen.totalGeneral)}`,
    '',
  ];

  if (resumen.porCategoria.length === 0) {
    lineas.push('🫙 No hay gastos registrados en este período.');
  } else {
    for (const categoria of resumen.porCategoria) {
      lineas.push(
        `• ${escapeHtml(categoria.categoriaNombre)} — ${formatearMonto(categoria.total)} (${categoria.porcentaje}%)`,
      );
    }
  }

  return lineas.join('\n');
}

export const MENSAJE_ERROR_RESUMEN = [
  '😕 <b>No pude calcular el resumen</b>',
  '',
  'El servicio de gastos no respondió. Probá de nuevo en un momento.',
].join('\n');
