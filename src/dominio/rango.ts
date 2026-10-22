/** Rangos de resumen que entiende api-gastos y devuelve servicio-ia. */
export type RangoResumen =
  | 'WEEK'
  | '15_DAYS'
  | 'MONTH'
  | '2_MONTHS'
  | 'YEAR';

export const RANGOS_RESUMEN: RangoResumen[] = [
  'WEEK',
  '15_DAYS',
  'MONTH',
  '2_MONTHS',
  'YEAR',
];

/** Valida un valor desconocido antes de enviarlo a api-gastos. */
export function esRangoResumen(valor: unknown): valor is RangoResumen {
  return (
    typeof valor === 'string' &&
    RANGOS_RESUMEN.includes(valor as RangoResumen)
  );
}
