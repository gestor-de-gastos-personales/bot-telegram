import type { BotContexto } from '../index.js';
import { GastosService } from '../services/gastos.service.js';
import { escapeHtml, formatearFecha, formatearMonto as formatearMontoHistorial } from '../utils/format.js';
import { logger } from '../utils/logger.js';

/** Cantidad de gastos por página del historial. */
export const LIMITE_POR_PAGINA = 10;

const ENCABEZADO = '📋 <b>Historial de gastos</b>';
const SIN_GASTOS = [
  '🫙 <b>Todavía no tenés gastos registrados</b>',
  '',
  'Escribime algo como <i>"Gasté 1500 en el Coto"</i> y lo guardo al toque.',
].join('\n');

import { construirFilaPaginacion, type BotonInline } from '../views/teclado.js';

export interface GastoHistorial {
  id: number;
  monto: number | string;
  descripcion?: string | null;
  fecha?: string | null;
  categoria?: { nombre?: string | null } | null;
}

export interface MetaHistorial {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface RespuestaHistorial {
  data: GastoHistorial[];
  meta: MetaHistorial;
}

/** Formatea un monto en pesos argentinos sin decimales innecesarios. */
export function formatearMonto(monto: number): string {
  return formatearMontoHistorial(monto);
}

/** Construye el texto de una página del historial con datos escapados. */
export function construirTextoHistorial(datos: GastoHistorial[], meta: MetaHistorial): string {
  const lineas = [ENCABEZADO, ''];

  for (const gasto of datos) {
    const fecha = formatearFecha(gasto.fecha);
    const categoria = gasto.categoria?.nombre ?? 'Sin categoría';
    const descripcion = gasto.descripcion
      ? ` · ${escapeHtml(gasto.descripcion)}`
      : '';

    lineas.push(
      `• <b>#${gasto.id}</b> · ${formatearMonto(Number(gasto.monto))} · ${escapeHtml(categoria)}${descripcion}`,
    );
    lineas.push(`   📅 ${fecha}`);
  }

  lineas.push('');
  lineas.push(
    `<i>Página ${meta.page} de ${Math.max(meta.totalPages, 1)}</i> · ${meta.total} gastos en total`,
  );

  return lineas.join('\n');
}

/**
 * Construye el teclado del historial: una fila por gasto con sus acciones
 * rápidas (editar y eliminar) y, al final, la paginación.
 */
export function construirTecladoHistorial(
  meta: MetaHistorial,
  gastos: GastoHistorial[] = [],
): BotonInline[][] {
  const teclado: BotonInline[][] = [];

  for (const gasto of gastos) {
    teclado.push([
      { text: `✏️ #${gasto.id}`, callback_data: `edit:${gasto.id}` },
      { text: `🗑️ #${gasto.id}`, callback_data: `del:${gasto.id}` },
    ]);
  }

  if (meta.totalPages <= 1) {
    return teclado;
  }

  const fila = construirFilaPaginacion(meta.page, meta.totalPages, {
    anterior: `hist:${meta.page - 1}`,
    siguiente: `hist:${meta.page + 1}`,
    noop: 'hist:noop',
  });

  teclado.push(fila);

  return teclado;
}

/** Busca una página del historial para el usuario actual. */
export async function obtenerPaginaHistorial(
  telegramId: string,
  page: number,
): Promise<RespuestaHistorial> {
  return GastosService.getUltimos(telegramId, {
    limit: LIMITE_POR_PAGINA,
    page: Math.max(page, 1),
  }) as Promise<RespuestaHistorial>;
}

/**
 * Muestra la página del historial (por comando o callback de paginación).
 *
 * `editarMensaje: false` fuerza una respuesta nueva en lugar de reemplazar
 * el mensaje que originó el callback (así el menú de ayuda sigue visible).
 */
export async function responderHistorial(
  ctx: BotContexto,
  page: number,
  ajustes: { editarMensaje?: boolean } = {},
): Promise<void> {
  const telegramId = String(ctx.from?.id ?? '');

  try {
    const { data, meta } = await obtenerPaginaHistorial(telegramId, page);

    if (data.length === 0) {
      await ctx.reply(SIN_GASTOS, { parse_mode: 'HTML' });
      return;
    }

    const texto = construirTextoHistorial(data, meta);
    const teclado = construirTecladoHistorial(meta, data);
    const markup = teclado.length > 0 ? { inline_keyboard: teclado } : undefined;
    const opciones =
      markup === undefined
        ? { parse_mode: 'HTML' as const }
        : { parse_mode: 'HTML' as const, reply_markup: markup };

    if (ajustes.editarMensaje !== false && ctx.callbackQuery?.message) {
      try {
        await ctx.editMessageText(texto, opciones);
      } catch (editError) {
        // Mensaje viejo o sin cambios: se ignora para no duplicar historial.
        logger.warn(
          { error: editError, telegramId },
          'No se pudo actualizar el mensaje del historial',
        );
      }
      return;
    }

    await ctx.reply(texto, opciones);
  } catch (error) {
    logger.error({ error, telegramId }, 'No se pudo obtener el historial de gastos');
    await ctx.reply(
      '😕 <b>No pude cargar tu historial</b>\n\nEl servicio no respondió. Probá de nuevo en un momento.',
      { parse_mode: 'HTML' },
    );
  }
}

/** Callback del teclado del historial: tolerante a mensajes viejos. */
export async function manejarCallbackHistorial(
  ctx: BotContexto,
  pagina: number,
): Promise<void> {
  const destino = Math.max(pagina, 1);

  try {
    await ctx.answerCallbackQuery();
    await responderHistorial(ctx, destino);
  } catch (error) {
    logger.warn(
      { error, destino },
      'Callback de historial no aplicable (mensaje viejo o sin cambios)',
    );
  }
}

/** Comando: /historial [número de página] */
export async function manejarHistorialComando(ctx: BotContexto) {
  const args = (typeof ctx.match === 'string' ? ctx.match : '').trim().split(/\s+/);
  const primeraPagina = Math.max(parseInt(args[0] || '1', 10) || 1, 1);
  // Siempre como mensaje nuevo: así no pisa el menú desde el que se :/pulsó.
  await responderHistorial(ctx, primeraPagina, { editarMensaje: false });
}

