/**
 * Constructor de configuraciones Chart.js v4 para QuickChart.
 *
 * Barras horizontales con top N + "Otros", etiquetas con monto y
 * porcentaje, y título con período y total. Pensado para ser legible
 * con muchas categorías (900x600).
 */

import { formatearFechaES } from '../dominio/fechas.js';
import type { RangoPeriodo } from '../dominio/periodo.js';

export type RangoGrafico = RangoPeriodo;

/** Período del gráfico: un rango predefinido o un rango de fechas. */
export type PeriodoGrafico =
  | RangoGrafico
  | { desde: string; hasta: string };

export const ETIQUETAS_RANGO: Record<RangoGrafico, string> = {
  TODAY: 'hoy',
  WEEK: 'esta semana',
  MONTH: 'este mes',
  YEAR: 'este año',
  '15_DAYS': 'los últimos 15 días',
  '2_MONTHS': 'los últimos 2 meses',
};

export interface CategoriaGrafico {
  categoriaNombre: string;
  total: number;
  porcentaje: number;
}

export interface ResumenGrafico {
  periodo: {
    rango?: string | null;
    mes?: number | null;
    anio: number;
    fechaInicio?: string;
    fechaFin?: string;
  };
  totalGeneral: number;
  porCategoria: CategoriaGrafico[];
}

/** Cantidad máxima de categorías que se dibujan individualmente. */
export const TOP_N = 8;

const PALETA = [
  '#f39c12',
  '#e67e22',
  '#e74c3c',
  '#9b59b6',
  '#3498db',
  '#16a085',
  '#27ae60',
  '#2ecc71',
];
const COLOR_OTROS = '#95a5a6';

/** Formatea montos en pesos argentinos (es-AR) con separador de miles. */
export function formatearMontoGrafico(monto: number): string {
  return `$${Number(monto).toLocaleString('es-AR', {
    maximumFractionDigits: 0,
  })}`;
}

/** Describe el período para usarlo en mensajes ("hoy", "del 01/01 al 06/11"). */
export function describirPeriodoGrafico(periodo: PeriodoGrafico): string {
  if (typeof periodo !== 'string') {
    return `del ${formatearFechaES(periodo.desde)} al ${formatearFechaES(periodo.hasta)}`;
  }
  return ETIQUETAS_RANGO[periodo];
}

/** Título del gráfico con período, total y año. */
export function construirTituloGrafico(
  resumen: ResumenGrafico,
  periodo: PeriodoGrafico,
): string {
  const total = formatearMontoGrafico(resumen.totalGeneral);

  if (typeof periodo !== 'string') {
    return `Gastos del ${formatearFechaES(periodo.desde)} al ${formatearFechaES(periodo.hasta)}: ${total}`;
  }

  const { mes, anio } = resumen.periodo;

  if (periodo === 'MONTH' && mes !== null && mes !== undefined) {
    const nombre = new Date(anio, mes - 1, 1).toLocaleString('es-AR', {
      month: 'long',
    });
    return `Gastos de ${nombre} ${anio}: ${total}`;
  }

  const titulos: Record<RangoGrafico, string> = {
    TODAY: 'Gastos de hoy',
    WEEK: 'Gastos de esta semana',
    MONTH: 'Gastos de este mes',
    YEAR: `Gastos de ${anio}`,
    '15_DAYS': 'Gastos de los últimos 15 días',
    '2_MONTHS': 'Gastos de los últimos 2 meses',
  };

  return `${titulos[periodo]}: ${total}`;
}

/**
 * Reduce la lista a top N + "Otros" (ordenada de mayor a menor).
 */
export function consolidarCategorias(
  categorias: CategoriaGrafico[],
  topN: number = TOP_N,
): CategoriaGrafico[] {
  const limpias = categorias
    .filter((c) => Number(c.total) > 0)
    .sort((a, b) => Number(b.total) - Number(a.total));

  if (limpias.length <= topN) {
    return limpias;
  }

  const principales = limpias.slice(0, topN);
  const restantes = limpias.slice(topN);
  const totalOtros = restantes.reduce((acc, c) => acc + Number(c.total), 0);
  const porcentajeOtros = restantes.reduce((acc, c) => acc + Number(c.porcentaje ?? 0), 0);

  return [...principales, { categoriaNombre: 'Otros', total: totalOtros, porcentaje: porcentajeOtros }];
}

/** Barras horizontales con monto y porcentaje en las etiquetas. */
export function construirConfigGrafico(
  resumen: ResumenGrafico,
  periodo: PeriodoGrafico,
): Record<string, unknown> {
  const categorias = consolidarCategorias(resumen.porCategoria);
  const invertido = categorias.map((c) => ({
    nombre: c.categoriaNombre,
    total: Number(c.total),
    porcentaje: Number(c.porcentaje ?? 0),
  }));

  // En barras horizontales de Chart.js, la primera etiqueta queda abajo.
  // Se invierte para que la categoría mayor aparezca arriba.
  const ordenado = [...invertido].reverse();

  const labels = ordenado.map((c) => `${c.nombre} ${formatearMontoGrafico(c.total)} (${c.porcentaje.toFixed(1)}%)`);
  const data = ordenado.map((c) => c.total);
  // El color sigue la posición original (mayor → menor) para que la
  // categoría principal use siempre el primer color de la paleta.
  const colorPorNombre = new Map<string, string>();
  invertido.forEach((c, i) => {
    colorPorNombre.set(c.nombre, c.nombre === 'Otros' ? COLOR_OTROS : (PALETA[i % PALETA.length] ?? COLOR_OTROS));
  });
  const colores = ordenado.map((c) => colorPorNombre.get(c.nombre) ?? COLOR_OTROS);

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Gastos',
          data,
          backgroundColor: colores,
          borderColor: colores,
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: construirTituloGrafico(resumen, periodo),
          font: { size: 20 },
          padding: { top: 10, bottom: 20 },
        },
        tooltip: {
          callbacks: {
            label: (ctx: { parsed?: { x?: number } }) =>
              ` ${formatearMontoGrafico(Number(ctx.parsed?.x ?? 0))}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 12 } },
        },
        y: {
          ticks: {
            font: { size: 14 },
            autoSkip: false,
          },
          afterFit: (scale: { width: number }) => {
            scale.width = 260;
          },
        },
      },
      layout: { padding: { right: 60 } },
    },
  };
}

/** URL de QuickChart con Chart.js v4, PNG 900x600. */
export function construirUrlGrafico(
  resumen: ResumenGrafico,
  periodo: PeriodoGrafico,
): string {
  const config = JSON.stringify(construirConfigGrafico(resumen, periodo));
  return `https://quickchart.io/chart?c=${encodeURIComponent(config)}&v=4&w=900&h=600`;
}
