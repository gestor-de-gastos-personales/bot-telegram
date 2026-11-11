import { escapeHtml, formatearFecha, formatearMonto } from '../utils/format.js';
import { construirFilaPaginacion, type BotonInline } from './teclado.js';

/** Acción que se puede hacer sobre un gasto desde los comandos interactivos. */
export type AccionGasto = 'eliminar' | 'modificar';

/** Campos que se pueden editar con /modificar. */
export type CampoEditable = 'monto' | 'comercio' | 'categoria' | 'fecha';

/** Gasto mínimo que necesitan las pantallas de /eliminar y /modificar. */
export interface GastoAccion {
  id: number;
  monto: number | string;
  descripcion?: string | null;
  fecha?: string | null;
  categoria?: { nombre?: string | null } | null;
}

/** Gastos por página en los comandos interactivos. */
export const LIMITE_POR_PAGINA = 5;

/** Mensajes compartidos. */
export const MENSAJE_SIN_GASTOS_ACCION = [
  '🫙 <b>Todavía no tenés gastos registrados</b>',
  '',
  'Escribime algo como <i>"Gasté 1500 en el Coto"</i> y lo guardo al toque.',
].join('\n');

export const MENSAJE_ACCION_CANCELADA = [
  '🚫 <b>Listo, no hice nada</b>',
  '',
  'Tus gastos siguen como estaban. Cuando quieras, probá de nuevo.',
].join('\n');

export const MENSAJE_ERROR_ACCION = [
  '😕 <b>No pude completar la operación</b>',
  '',
  'Puede que el servicio esté ocupado. Probá de nuevo en un momento.',
].join('\n');

export const MENSAJE_GASTO_NO_ENCONTRADO = [
  '🤷 <b>No encontré ese gasto</b>',
  '',
  'Puede que ya lo hayas eliminado. Te paso la lista actualizada.',
].join('\n');

const ETIQUETAS_CAMPO: Record<CampoEditable, string> = {
  monto: 'monto',
  comercio: 'comercio',
  categoria: 'categoría',
  fecha: 'fecha',
};

/** Formatea un monto sin decimales innecesarios (es-AR). */
export function formatearMontoAccion(monto: number | string): string {
  return formatearMonto(monto);
}

/** Muestra una fecha ISO (o ISO con hora) como DD/MM/YYYY. */
export function formatearFechaAccion(fecha?: string | null): string {
  return formatearFecha(fecha);
}

/** Descripción corta y escapada para usar dentro de mensajes HTML. */
function descripcionCorta(gasto: GastoAccion): string {
  const texto = (gasto.descripcion ?? '').trim();
  if (!texto) return 'Sin descripción';
  const recortado = texto.length > 40 ? `${texto.slice(0, 40)}…` : texto;
  return escapeHtml(recortado);
}

/** Texto de la lista de gastos recientes para elegir uno (solo una página). */
export function construirTextoLista(
  gastos: GastoAccion[],
  accion: AccionGasto,
  paginacion?: { pagina: number; totalPages: number },
): string {
  const titulo =
    accion === 'eliminar'
      ? '🗑️ <b>¿Qué gasto querés eliminar?</b>'
      : '✏️ <b>¿Qué gasto querés modificar?</b>';

  const lineas = [
    titulo,
    '',
    'Tocá el gasto que quieras y te muestro el detalle 👇',
    '',
  ];

  for (const gasto of gastos) {
    lineas.push(
      `• <b>#${gasto.id}</b> · ${formatearMontoAccion(gasto.monto)} · ${descripcionCorta(gasto)}`,
    );
    lineas.push(
      `   🏷️ ${escapeHtml(gasto.categoria?.nombre ?? 'Sin categoría')} · 📅 ${formatearFechaAccion(gasto.fecha)}`,
    );
  }

  if (paginacion && paginacion.totalPages > 1) {
    lineas.push('');
    lineas.push(
      `<i>Página ${paginacion.pagina} de ${paginacion.totalPages}</i> · Usá las flechas para ver más.`,
    );
  }

  return lineas.join('\n');
}

/** Botones para confirmar o cancelar la eliminación. */
export function construirTecladoConfirmarEliminar(id: number): BotonInline[][] {
  return [
    [
      { text: '🗑️ Sí, eliminar', callback_data: `delok:${id}` },
      { text: '↩️ No', callback_data: 'delno' },
    ],
  ];
}

/** Detalle del gasto y campos disponibles para modificar. */
export function construirTextoDetalleModificar(gasto: GastoAccion): string {
  return [
    `✏️ <b>Modificar gasto #${gasto.id}</b>`,
    '',
    `🏷️ ${escapeHtml(gasto.categoria?.nombre ?? 'Sin categoría')}`,
    `💰 <b>${formatearMontoAccion(gasto.monto)}</b>`,
    `📅 ${formatearFechaAccion(gasto.fecha)}`,
    `📝 ${descripcionCorta(gasto)}`,
    '',
    '───────────────',
    '¿Qué querés cambiar? Tocá un campo 👇',
  ].join('\n');
}

/** Botones con los campos editables del gasto. */
export function construirTecladoCampos(id: number): BotonInline[][] {
  return [
    [
      { text: '💰 Monto', callback_data: `editf:${id}:monto` },
      { text: '🏪 Comercio', callback_data: `editf:${id}:comercio` },
    ],
    [
      { text: '🏷️ Categoría', callback_data: `editf:${id}:categoria` },
      { text: '📅 Fecha', callback_data: `editf:${id}:fecha` },
    ],
    [{ text: '🚫 Cancelar', callback_data: 'editno' }],
  ];
}

/** Instrucción que se muestra al elegir un campo para modificar. */
export function construirTextoCampoElegido(
  gasto: GastoAccion,
  campo: CampoEditable,
): string {
  const instrucciones: Record<CampoEditable, string> = {
    monto: '💰 Enviame el nuevo monto.\n   <i>Ej: 2500 · $2.500,50</i>',
    comercio: '🏪 Enviame el nuevo comercio.\n   <i>Ej: Coto</i>',
    categoria: '🏷️ Enviame una categoría existente.\n   <i>Ej: Alimentación</i>',
    fecha: '📅 Enviame la nueva fecha.\n   <i>Ej: hoy · ayer · 011226 · 01/12/2026</i>',
  };

  return [
    `✏️ <b>Modificar ${ETIQUETAS_CAMPO[campo]}</b>`,
    '',
    `Gasto <b>#${gasto.id}</b> · ${descripcionCorta(gasto)}`,
    '',
    instrucciones[campo],
    '',
    '───────────────',
    '<i>Si te arrepentís, tocá Cancelar.</i>',
  ].join('\n');
}

/** Teclado mínimo para abandonar el flujo de modificación. */
export function construirTecladoCancelar(): BotonInline[][] {
  return [[{ text: '🚫 Cancelar', callback_data: 'editno' }]];
}

/** Mensaje de confirmación después de eliminar. */
export function mensajeEliminado(gasto: GastoAccion): string {
  return [
    '✅ <b>Gasto eliminado</b>',
    '',
    `#${gasto.id} · ${descripcionCorta(gasto)} · ${formatearMontoAccion(gasto.monto)}`,
  ].join('\n');
}

/** Mensaje de confirmación con el gasto actualizado. */
export function mensajeActualizado(gasto: GastoAccion): string {
  return [
    `✅ <b>Gasto #${gasto.id} actualizado</b>`,
    '',
    `🏷️ ${escapeHtml(gasto.categoria?.nombre ?? 'Sin categoría')}`,
    `💰 <b>${formatearMontoAccion(gasto.monto)}</b>`,
    `📅 ${formatearFechaAccion(gasto.fecha)}`,
    `📝 ${descripcionCorta(gasto)}`,
  ].join('\n');
}

/**
 * Parsea un monto escrito en texto.
 * Acepta formatos argentinos ($2.500,50) y simples (2500.50).
 * Devuelve `null` si es vacío, cero, negativo o no numérico.
 */
export function parsearMontoAccion(texto: string): number | null {
  const limpio = texto.trim().replace(/^\$\s*/, '');
  if (!limpio) return null;

  const normalizado = limpio.replace(/\s/g, '');
  const tieneComa = normalizado.includes(',');
  const tienePunto = normalizado.includes('.');

  let valor: number;

  if (tieneComa && tienePunto) {
    // El último separador que aparece es el decimal.
    const ultimo = normalizado.lastIndexOf(',') > normalizado.lastIndexOf('.') ? ',' : '.';
    const decimal = ultimo;
    const miles = ultimo === ',' ? '.' : ',';
    const normalizado2 = normalizado.split(miles).join('').replace(decimal, '.');
    valor = Number(normalizado2);
  } else if (tieneComa) {
    // "2.500,50" ya cubierto arriba; acá "2500,50" => decimal.
    valor = Number(normalizado.replace(',', '.'));
  } else if (tienePunto) {
    // "2500.50" => decimal; "2.500" puede ser miles.
    const partes = normalizado.split('.');
    valor =
      partes.length === 2 && partes[1]?.length === 3
        ? Number(partes.join(''))
        : Number(normalizado);
  } else {
    valor = Number(normalizado);
  }

  if (!Number.isFinite(valor)) return null;
  if (valor <= 0) return null;
  return valor;
}

/** Arma el cuerpo del PATCH para cada campo editable. */
export function construirDatosEdicion(
  campo: CampoEditable,
  texto: string,
): { [k: string]: string | number } | null {
  const valor = texto.trim();

  switch (campo) {
    case 'monto': {
      const monto = parsearMontoAccion(valor);
      if (monto === null) return null;
      return { monto };
    }
    case 'comercio': {
      if (valor.length < 2) return null;
      return { comercio: valor };
    }
    case 'categoria': {
      if (!valor) return null;
      return { categoria: valor };
    }
    case 'fecha': {
      const iso = normalizarFechaAccion(valor);
      if (!iso) return null;
      return { fecha: iso };
    }
    default:
      return null;
  }
}

/**
 * Convierte una fecha escrita a ISO (YYYY-MM-DD).
 * Acepta hoy, ayer, DDMMAA, DD/MM/AAAA y DD-MM-AAAA.
 */
export function normalizarFechaAccion(texto: string, hoy: Date = new Date()): string | null {
  const limpio = texto.trim().toLowerCase();
  if (!limpio) return null;

  if (limpio === 'hoy') return hoy.toISOString().slice(0, 10);
  if (limpio === 'ayer') {
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    return ayer.toISOString().slice(0, 10);
  }

  const soloDigitos = limpio.replace(/[^\d]/g, '');

  // DDMMAA o DDMMAAAA
  if (soloDigitos.length === 6 || soloDigitos.length === 8) {
    const dia = soloDigitos.slice(0, 2);
    const mes = soloDigitos.slice(2, 4);
    const anio = soloDigitos.length === 6 ? `20${soloDigitos.slice(4, 6)}` : soloDigitos.slice(4, 8);
    return construirIso(dia, mes, anio);
  }

  // DD/MM/AAAA o DD-MM-AAAA
  const conSeparador = limpio.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (conSeparador) {
    const dia = conSeparador[1];
    const mes = conSeparador[2];
    const anioRaw = conSeparador[3];
    if (!dia || !mes || !anioRaw) return null;
    const anio = anioRaw.length === 2 ? `20${anioRaw}` : anioRaw;
    return construirIso(dia, mes, anio);
  }

  return null;
}

/** Construye una fecha ISO validando que exista en el calendario. */
function construirIso(dia: string, mes: string, anio: string): string | null {
  const d = Number(dia);
  const m = Number(mes);
  const a = Number(anio);

  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const fecha = new Date(Date.UTC(a, m - 1, d));
  if (fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) return null;

  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

/**
 * Teclado de paginación para listas de gastos.
 *
 * El `callback_data` incluye la acción para que el bot sepa a qué lista
 * pertenece la página: `pagina:eliminar:2` o `pagina:modificar:2`.
 */
export function construirTecladoPaginacion(
  pagina: number,
  totalPages: number,
  accion: AccionGasto = 'eliminar',
): BotonInline[][] {
  if (totalPages <= 1) return [];

  const fila = construirFilaPaginacion(pagina, totalPages, {
    anterior: `pagina:${accion}:${pagina - 1}`,
    siguiente: `pagina:${accion}:${pagina + 1}`,
    noop: `pagina:${accion}:noop`,
  });

  return [fila];
}

/**
 * Botones de la lista de gastos: uno por gasto y uno de cancelar.
 * Usa el prefijo `del:` para eliminar y `edit:` para modificar.
 */
export function construirTecladoLista(
  gastos: GastoAccion[],
  accion: AccionGasto,
): BotonInline[][] {
  const prefijo = accion === 'eliminar' ? 'del' : 'edit';
  const icono = accion === 'eliminar' ? '🗑️' : '✏️';
  const teclado: BotonInline[][] = [];

  for (const gasto of gastos) {
    teclado.push([
      {
        text: `${icono} #${gasto.id} · ${formatearMontoAccion(gasto.monto)} · ${descripcionCorta(gasto)}`,
        callback_data: `${prefijo}:${gasto.id}`,
      },
    ]);
  }

  teclado.push([
    {
      text: '🚫 Cancelar y volver',
      callback_data: accion === 'eliminar' ? 'delno' : 'editno',
    },
  ]);

  return teclado;
}

/** Detalle del gasto a eliminar y confirmación. */
export function construirTextoDetalleEliminar(gasto: GastoAccion): string {
  return [
    `🗑️ <b>Eliminar gasto #${gasto.id}</b>`,
    '',
    `🏷️ ${escapeHtml(gasto.categoria?.nombre ?? 'Sin categoría')}`,
    `💰 <b>${formatearMontoAccion(gasto.monto)}</b>`,
    `📅 ${formatearFechaAccion(gasto.fecha)}`,
    `📝 ${descripcionCorta(gasto)}`,
    '',
    '───────────────',
    '⚠️ <b>Esta acción no se puede deshacer.</b>',
    '¿Confirmás que lo elimino?',
  ].join('\n');
}

/** Calcula el total de páginas dado un total de elementos y el límite por página. */
export function calcularTotalPaginas(total: number, limite?: number): number {
  const p = limite ?? LIMITE_POR_PAGINA;
  return Math.max(1, Math.ceil(total / p));
}

/** Verifica si un campo es editable. */
export function esCampoEditable(campo: string): campo is CampoEditable {
  return ['monto', 'comercio', 'categoria', 'fecha'].includes(campo);
}

/** Explica qué se esperado cuando el valor enviado no es válido. */
export function mensajeValorInvalido(campo: CampoEditable): string {
  const ayudas: Record<CampoEditable, string> = {
    monto: 'Enviame un monto válido, por ejemplo 2500 o $2.500,50.',
    comercio: 'Enviame un nombre de comercio de al menos 2 letras.',
    categoria: 'Enviame el nombre de una categoría existente, por ejemplo Alimentación.',
    fecha: 'Enviame una fecha válida, por ejemplo hoy, ayer, 011226 o 01/12/2026.',
  };

  return [
    '🤔 <b>No te entendí ese valor</b>',
    '',
    ayudas[campo],
    '',
    'Probá de nuevo 👇',
  ].join('\n');
}