import { parsearRango } from './fechas.js';
import type { RangoResumen } from './rango.js';

/**
 * Rangos que se pueden pedir con una palabra en /resumen o /grafico.
 * Son los mismos que api-gastos acepta como `rango`.
 */
export type RangoPeriodo = RangoResumen;

/** Período pedido por el usuario en `/resumen` o `/grafico`. */
export type PeriodoConsultado =
  | { tipo: 'rango'; rango: RangoPeriodo }
  | { tipo: 'fechas'; desde: string; hasta: string; invertido?: boolean };

const RANGOS_POR_PALABRA: Record<string, RangoPeriodo> = {
  hoy: 'TODAY',
  dia: 'TODAY',
  día: 'TODAY',
  semana: 'WEEK',
  mes: 'MONTH',
  anio: 'YEAR',
  año: 'YEAR',
  ano: 'YEAR',
};

/**
 * Interpreta el argumento de `/resumen` y `/grafico`.
 *
 * Acepta las palabras `hoy`, `semana`, `mes` y `año` (también sin tilde),
 * o fechas en los formatos de `parsearRango` (`010126`, `01/01/2026`,
 * `011226 311226`, etc.).
 *
 * Devuelve `null` cuando el texto no se puede interpretar.
 */
export function interpretarPeriodo(
  texto: string,
  hoy: Date,
): PeriodoConsultado | null {
  const limpio = texto.trim().toLowerCase();
  if (!limpio) return null;

  const rango = RANGOS_POR_PALABRA[limpio];
  if (rango) return { tipo: 'rango', rango };

  const fechas = parsearRango(limpio, hoy);
  if (!fechas) return null;

  return {
    tipo: 'fechas',
    desde: fechas.desde,
    hasta: fechas.hasta,
    ...(fechas.invertido ? { invertido: true } : {}),
  };
}
