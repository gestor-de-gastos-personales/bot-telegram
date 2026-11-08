/**
 * Parseo de fechas escritas por texto para el resumen por rango.
 *
 * Formatos aceptados (convención rioplatense: día primero):
 *   011226    -> 01/12/2026
 *   0112      -> 01/12 del año actual
 *   01        -> 01 del mes y del año actuales
 *   1/12/26   -> 01/12/2026
 *   1-12-2026 -> 01/12/2026
 *   hoy       -> la fecha de hoy
 *
 * Si no se indica el año se asume el año actual; si no se indica el mes, el mes actual.
 */

/** Rango de fechas listo para enviar a api-gastos. */
export interface RangoFechas {
  desde: string;
  hasta: string;
  /** True cuando el usuario escribió las fechas al revés y se corrigieron. */
  invertido?: boolean;
}

/** Devuelve la fecha en formato ISO (YYYY-MM-DD). */
export function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Muestra una fecha ISO como DD/MM/YYYY. */
export function formatearFechaES(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** Verifica que la fecha exista en el calendario (incluye años bisiestos). */
export function esFechaValida(anio: number, mes: number, dia: number): boolean {
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || !Number.isInteger(dia)) {
    return false;
  }
  if (mes < 1 || mes > 12 || dia < 1) return false;
  return dia <= new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Convierte un año de 1 o 2 dígitos al siglo actual (26 -> 2026). */
function normalizarAnio(anio: number): number {
  return anio < 100 ? 2000 + anio : anio;
}

function construirIso(
  dia: number,
  mes: number,
  anio: number,
): string | null {
  if (!esFechaValida(anio, mes, dia)) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Interpreta una cadena de solo dígitos según su largo. */
function parsearSoloDigitos(digitos: string, hoy: Date): string | null {
  const anioActual = hoy.getUTCFullYear();
  const mesActual = hoy.getUTCMonth() + 1;

  if (digitos.length === 8) {
    return construirIso(
      Number(digitos.slice(0, 2)),
      Number(digitos.slice(2, 4)),
      Number(digitos.slice(4, 8)),
    );
  }

  if (digitos.length === 6) {
    return construirIso(
      Number(digitos.slice(0, 2)),
      Number(digitos.slice(2, 4)),
      normalizarAnio(Number(digitos.slice(4, 6))),
    );
  }

  if (digitos.length === 4) {
    // Día y mes; si no cierra como DD/MM se intenta MM/DD.
    return (
      construirIso(Number(digitos.slice(0, 2)), Number(digitos.slice(2, 4)), anioActual) ??
      construirIso(Number(digitos.slice(2, 4)), Number(digitos.slice(0, 2)), anioActual)
    );
  }

  if (digitos.length === 3) {
    return (
      construirIso(Number(digitos[0]), Number(digitos.slice(1, 3)), anioActual) ??
      construirIso(Number(digitos.slice(0, 2)), Number(digitos[2]), anioActual)
    );
  }

  if (digitos.length === 5) {
    return construirIso(
      Number(digitos.slice(0, 2)),
      Number(digitos.slice(2, 4)),
      normalizarAnio(Number(digitos[4])),
    );
  }

  if (digitos.length === 2 || digitos.length === 1) {
    return construirIso(Number(digitos), mesActual, anioActual);
  }

  return null;
}

/**
 * Parsea una fecha suelta. Devuelve la fecha ISO o `null` si no se entiende.
 */
export function parsearFecha(entrada: string, hoy: Date): string | null {
  const texto = entrada.trim().toLowerCase();
  if (!texto) return null;

  if (texto === 'hoy') return aIso(hoy);
  if (texto === 'ayer') {
    const ayer = new Date(hoy);
    ayer.setUTCDate(ayer.getUTCDate() - 1);
    return aIso(ayer);
  }

  const grupos = texto.split(/[^\d]+/).filter(Boolean);
  if (grupos.length === 0) return null;

  if (grupos.length === 1) {
    const digitos = grupos[0];
    return digitos ? parsearSoloDigitos(digitos, hoy) : null;
  }

  if (grupos.length === 2) {
    const dia = Number(grupos[0]);
    const mes = Number(grupos[1]);
    const anioActual = hoy.getUTCFullYear();
    return (
      construirIso(dia, mes, anioActual) ?? construirIso(mes, dia, anioActual)
    );
  }

  if (grupos.length === 3) {
    return construirIso(
      Number(grupos[0]),
      Number(grupos[1]),
      normalizarAnio(Number(grupos[2])),
    );
  }

  return null;
}

/**
 * Normaliza el rango: si la fecha inicial es posterior a la final, las intercambia
 * (api-gastos rechaza ese orden con un 400).
 */
function normalizar(desde: string, hasta: string): RangoFechas {
  if (desde > hasta) {
    return { desde: hasta, hasta: desde, invertido: true };
  }
  return { desde, hasta };
}

/**
 * Parsea un rango escrito por texto ("011226 311226", "del 1/12 al 31/12").
 *
 * Con una sola fecha, el rango va desde esa fecha hasta hoy.
 */
export function parsearRango(texto: string, hoy: Date): RangoFechas | null {
  const limpio = texto.trim();
  if (!limpio) return null;

  const completa = parsearFecha(limpio, hoy);
  if (completa) {
    return normalizar(completa, aIso(hoy));
  }

  const separadores = [
    /\s*(?:al|hasta|a|desde|de)\s+/i,
    /\s*[-–—]\s*/,
    /[\s,;]+/,
  ];

  for (const separador of separadores) {
    const partes = limpio
      .split(separador)
      .map((parte) => parte.trim())
      .filter(Boolean);
    const fechas = partes
      .map((parte) => parsearFecha(parte, hoy))
      .filter((fecha): fecha is string => fecha !== null);

    if (fechas.length >= 2) {
      const [primera, segunda] = fechas;
      if (primera && segunda) {
        return normalizar(primera, segunda);
      }
    }
  }

  return null;
}
