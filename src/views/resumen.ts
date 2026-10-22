import type { RangoResumen } from '../dominio/rango.js';
import { escapeHtml } from '../utils/format.js';

/** Etiqueta legible de cada rango que devuelve api-gastos. */
export const ETIQUETAS_RANGO: Record<RangoResumen, string> = {
  WEEK: 'esta semana',
  '15_DAYS': 'los últimos 15 días',
  MONTH: 'este mes',
  '2_MONTHS': 'los últimos 2 meses',
  YEAR: 'este año',
};

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
export function formatearResumen(resumen: {
  periodo: ResumenPeriodo;
  totalGeneral: number;
  porCategoria: Array<{
    categoriaNombre: string;
    total: number;
    porcentaje: number;
  }>;
}): string {
  const lineas = [
    `📊 <b>Resumen de ${etiquetaPeriodo(resumen.periodo)}</b>`,
    '',
    `💰 <b>Total:</b> $${resumen.totalGeneral}`,
    '',
  ];

  if (resumen.porCategoria.length === 0) {
    lineas.push('No hay gastos registrados en el período.');
  } else {
    for (const categoria of resumen.porCategoria) {
      lineas.push(
        `• ${escapeHtml(categoria.categoriaNombre)}: $${categoria.total} (${categoria.porcentaje}%)`,
      );
    }
  }

  return lineas.join('\n');
}

export const MENSAJE_ERROR_RESUMEN =
  '⚠️ No pude obtener el resumen de tus gastos. Intentá de nuevo más tarde.';
