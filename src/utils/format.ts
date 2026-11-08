/**
 * Utilidades de formato para los mensajes del bot.
 */

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
 * Formatea un monto en pesos argentinos con separador de miles.
 *
 * Es el único lugar donde se decide cómo se muestran los importes, para que
 * todos los comandos del bot se vean igual: 1500 -> $1.500.
 */
export function formatearMonto(monto: number | string | null | undefined): string {
  const valor = typeof monto === 'string' ? Number(monto) : (monto ?? 0);

  if (!Number.isFinite(valor)) {
    return '$0';
  }

  return `$${valor.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Muestra una fecha ISO (o ISO con hora) como DD/MM/YYYY.
 * Es el único lugar donde se decide cómo se ven las fechas del bot.
 */
export function formatearFecha(fecha?: string | null): string {
  if (!fecha) return 'sin fecha';

  const iso = String(fecha).slice(0, 10);
  const [anio, mes, dia] = iso.split('-');
  if (!anio || !mes || !dia) return iso;

  return `${dia}/${mes}/${anio}`;
}

/** Separador visual entre bloques de un mensaje. */
export const SEPARADOR = '───────────────';

/** Emojis usados en todo el bot para que los mensajes se vean consistentes. */
export const ICONOS = {
  exito: '✅',
  error: '❌',
  aviso: '⚠️',
  info: 'ℹ️',
  cancelado: '🚫',
} as const;
