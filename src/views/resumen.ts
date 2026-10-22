import type { ResumenGastos } from '../services/gastos.service.js';
import { escapeHtml } from '../utils/format.js';

/**
 * Renderiza el resumen mensual/anual que devuelve api-gastos.
 */
export function formatearResumen(resumen: ResumenGastos): string {
  const { mes, anio } = resumen.periodo;
  const periodo =
    mes !== null ? `${String(mes).padStart(2, '0')}/${anio}` : `año ${anio}`;

  const lineas = [
    `📊 <b>Resumen de ${periodo}</b>`,
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
