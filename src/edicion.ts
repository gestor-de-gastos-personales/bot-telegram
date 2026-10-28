import type { GastoAnalizado } from './services/ia.service.js';

/** Campos del gasto pendiente que el usuario puede corregir por texto. */
export type CampoEditable = 'monto' | 'comercio' | 'descripcion' | 'categoria' | 'fecha';

export interface ResultadoEdicion {
  gasto: GastoAnalizado;
  /** Descripción corta de lo que se modificó, para confirmar al usuario. */
  cambio?: string;
}

interface PatronCorreccion {
  campo: CampoEditable;
  regex: RegExp;
  /** Grupo de la regex que contiene el valor (por defecto, el primero). */
  grupo?: number;
}

/**
 * Expresiones que el usuario escribe para corregir un dato del gasto
 * pendiente sin tener que abrir un menú de edición.
 */
const PATRONES: PatronCorreccion[] = [
  { campo: 'monto', regex: /(?:el\s+)?(?:precio|monto|monto\s+es|valor|total)\s*(?:es|son|de|:|=)?\s*\$?\s*([\d.,]+)/i },
  { campo: 'monto', regex: /(?:en\s+realidad\s+)?(?:fueron|sali[oó]|cost[oó]|gast[eé]|pagu[eé])\s+\$?\s*([\d.,]+)/i },
  { campo: 'monto', regex: /^\$?\s*([\d.,]+)\s*$/ },
  { campo: 'comercio', regex: /(?:sino\s+(?:en|a|que\s+era|que\s+fue|que\s+es))\s+(.+?)(?:\.|$)/i },
  { campo: 'comercio', regex: /(?:en\s+cambio|ahora|mejor)\s+(?:es|era|fue)\s+(?:en\s+)?(.+?)(?:\.|$)/i },
  { campo: 'comercio', regex: /(?:no\s+(?:era|es|fue)\s+(?:en\s+)?)(.+?)\s+sino\s+(?:en\s+)?(.+?)(?:\.|$)/i, grupo: 2 },
  { campo: 'comercio', regex: /(?:el\s+)?(?:comercio|local|tienda|negocio)\s*(?:es|fue|era|:|=)\s*(.+?)(?:\s+sino\b.*)?$/i },
  { campo: 'comercio', regex: /(?:era\s+en|fue\s+en)\s+(.+?)(?:\s+sino\b.*)?$/i },
  { campo: 'categoria', regex: /(?:la\s+)?categor[ií]a\s*(?:es|fue|era|:|=)\s*(.+?)(?:\s+sino\b.*)?$/i },
  { campo: 'categoria', regex: /(?:la\s+)?categor[ií]a\s+([a-záéíóúüñ][^\n\r.,;:!?]*?)$/i },
  { campo: 'categoria', regex: /(?:sino\s+(?:que\s+)?(?:es|era|era\s+de))\s+(.+?)(?:\.|$)/i },
  { campo: 'categoria', regex: /(?:cambi[áa]le\s+la\s+categor[ií]a\s+a)\s+(.+?)(?:\.|$)/i },
  { campo: 'descripcion', regex: /(?:la\s+)?(?:descripci[oó]n)\s*(?:es|fue|era|:|=)\s*(.+)/i },
  { campo: 'descripcion', regex: /(?:pon[eé]le|escribe|anot[aá]|dec[ií])\s+(.+)/i },
  { campo: 'categoria', regex: /(?:era|es)\s+de\s+(.+?)(?:\s+sino\b.*)?$/i },
  { campo: 'fecha', regex: /(?:la\s+)?fecha\s*(?:es|fue|era|:|=)\s*(.+)/i },
  { campo: 'fecha', regex: /(?:en\s+realidad\s+)?(?:fue|era|es)\s+(ayer|hoy|anteayer|el\s+\w+)/i },
];

/** Normaliza formatos como "$1.500,50" o "1500.50". */
export function parsearMonto(valor: string): number | null {
  let limpio = valor.replace(/[$\s]/g, '');

  if (limpio.includes(',') && limpio.includes('.')) {
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    limpio = limpio.replace(/\./g, '');
  } else {
    limpio = limpio.replace(',', '.');
  }

  const monto = Number(limpio);
  return Number.isFinite(monto) && monto > 0 ? monto : null;
}

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function fechaISO(ahora: Date): string {
  return ahora.toISOString().slice(0, 10);
}

function diasAtras(ahora: Date, dias: number): string {
  return fechaISO(new Date(ahora.getTime() - dias * 86_400_000));
}

/** Última ocurrencia de un día de la semana ("el lunes") antes de hoy. */
function ultimoDiaSemana(diaBuscado: string, ahora: Date): string | null {
  const indice = DIAS_SEMANA.indexOf(diaBuscado);
  if (indice < 0) return null;

  const diferencia = (ahora.getUTCDay() - indice + 7) % 7 || 7;
  return diasAtras(ahora, diferencia);
}

/** Convierte una fecha DD/MM o DD/MM/AAAA a ISO. */
function parsearFechaNumerica(texto: string, ahora: Date): string | null {
  const partes = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(texto);
  if (!partes) return null;

  const anio = partes[3] ? Number(partes[3]) : ahora.getUTCFullYear();
  const fecha = new Date(Date.UTC(anio, Number(partes[2]) - 1, Number(partes[1])));

  return Number.isNaN(fecha.getTime()) ? null : fechaISO(fecha);
}

/** Convierte expresiones relativas ("ayer", "el lunes") a fecha ISO. */
export function parsearFecha(valor: string, ahora: Date = new Date()): string | null {
  const texto = valor.trim().toLowerCase();

  if (texto === 'hoy') return fechaISO(ahora);
  if (texto === 'anteayer') return diasAtras(ahora, 2);
  if (/^el\s+ayer$|^ayer$/.test(texto)) return diasAtras(ahora, 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  const numerica = parsearFechaNumerica(texto, ahora);
  if (numerica) return numerica;

  return ultimoDiaSemana(/^el\s+(\w+)/.exec(texto)?.[1] ?? '', ahora);
}

function limpiarTexto(valor: string): string {
  return valor
    .replace(/\s*[.!]+$/, '')
    .replace(/^["'“”]|["'“”]$/g, '')
    .trim();
}

function aplicarCambio(
  gasto: GastoAnalizado,
  campo: CampoEditable,
  valor: string,
  ahora: Date,
): ResultadoEdicion | null {
  if (campo === 'monto') {
    const monto = parsearMonto(valor);
    return monto === null
      ? null
      : { gasto: { ...gasto, monto }, cambio: `💰 Monto: $${monto}` };
  }

  if (campo === 'fecha') {
    const fecha = parsearFecha(valor, ahora);
    return fecha === null
      ? null
      : { gasto: { ...gasto, fecha }, cambio: `📅 Fecha: ${fecha}` };
  }

  const texto = limpiarTexto(valor);
  if (!texto) return null;

  const etiquetas: Record<'comercio' | 'descripcion' | 'categoria', string> = {
    comercio: '🏪 Comercio',
    descripcion: '📝 Descripción',
    categoria: '🏷️ Categoría',
  };

  return {
    gasto: { ...gasto, [campo]: texto },
    cambio: `${etiquetas[campo]}: ${texto}`,
  };
}

/**
 * Interpreta un mensaje del usuario como una corrección del gasto pendiente.
 * Devuelve null cuando el texto no expresa una edición reconocible.
 */
export function interpretarEdicion(
  gasto: GastoAnalizado,
  texto: string,
  ahora: Date = new Date(),
): ResultadoEdicion | null {
  const mensaje = texto.trim();

  for (const patron of PATRONES) {
    const coincidencia = patron.regex.exec(mensaje);
    const valor = coincidencia?.[patron.grupo ?? 1];
    if (!coincidencia || valor === undefined) continue;

    const resultado = aplicarCambio(gasto, patron.campo, valor, ahora);
    if (resultado) return resultado;
  }

  return null;
}
