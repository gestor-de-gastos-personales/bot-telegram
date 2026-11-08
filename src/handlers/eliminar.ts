import type { BotContexto } from '../index.js';
import { GastosService } from '../services/gastos.service.js';
import { logger } from '../utils/logger.js';
import {
  LIMITE_POR_PAGINA,
  MENSAJE_ACCION_CANCELADA,
  MENSAJE_GASTO_NO_ENCONTRADO,
  MENSAJE_SIN_GASTOS_ACCION,
  construirTecladoPaginacion,
  construirTecladoLista,
  construirTextoDetalleEliminar,
  construirTextoLista,
  calcularTotalPaginas,
  mensajeEliminado,
  construirTecladoConfirmarEliminar,
  type GastoAccion,
} from '../views/acciones.js';
import { responderErrorAccion, responderOEditar } from './comun.js';

/** Trae los últimos gastos del usuario paginados para elegir cuál eliminar. */
async function listarUltimos(
  telegramId: string,
  pagina: number = 1,
): Promise<{ data: GastoAccion[]; total: number }> {
  const respuesta = await GastosService.getUltimos(telegramId, {
    limit: LIMITE_POR_PAGINA,
    ...(pagina > 1 ? { page: pagina } : {}),
  });

  return {
    data: (respuesta.data ?? []) as GastoAccion[],
    total: respuesta.meta?.total ?? 0,
  };
}

/** Comando: /eliminar — lista los últimos gastos con paginación estilo historial. */
export async function manejarEliminarComando(ctx: BotContexto): Promise<void> {
  const telegramId = String(ctx.from?.id ?? '');

  try {
    const { data: gastos, total } = await listarUltimos(telegramId, 1);
    const totalPages = calcularTotalPaginas(total);

    if (gastos.length === 0) {
      await ctx.reply(MENSAJE_SIN_GASTOS_ACCION, { parse_mode: 'HTML' });
      return;
    }

    await ctx.reply(
      construirTextoLista(gastos, 'eliminar', {
        pagina: 1,
        totalPages,
      }),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...construirTecladoLista(gastos, 'eliminar'),
            ...construirTecladoPaginacion(1, totalPages, 'eliminar'),
          ],
        },
      },
    );
  } catch (error) {
    await responderErrorAccion(
      ctx,
      error,
      'No se pudieron listar los gastos para eliminar',
    );
  }
}

/** Callback del botón de un gasto: muestra el detalle antes de borrar. */
export async function manejarSeleccionEliminar(
  ctx: BotContexto,
  gastoId: number,
): Promise<void> {
  await ctx.answerCallbackQuery();
  const telegramId = String(ctx.from?.id ?? '');

  try {
    const gasto = (await GastosService.getGastoById(
      gastoId,
      telegramId,
    )) as GastoAccion;

    await responderOEditar(
      ctx,
      construirTextoDetalleEliminar(gasto),
      construirTecladoConfirmarEliminar(gastoId),
    );
  } catch (error) {
    logger.warn(
      { detalle: String(error), gastoId, telegramId },
      'No se pudo abrir el detalle del gasto para eliminar',
    );
    await responderOEditar(ctx, MENSAJE_GASTO_NO_ENCONTRADO);
  }
}

/** Callback de paginación: cambia de página. */
export async function manejarPaginacionEliminar(
  ctx: BotContexto,
  pagina: number,
): Promise<void> {
  await ctx.answerCallbackQuery();
  const telegramId = String(ctx.from?.id ?? '');

  try {
    const { data: gastos, total } = await listarUltimos(telegramId, pagina);
    const totalPages = calcularTotalPaginas(total);

    if (gastos.length === 0) {
      await responderOEditar(
        ctx,
        MENSAJE_SIN_GASTOS_ACCION,
        construirTecladoPaginacion(pagina, totalPages, 'eliminar'),
      );
      return;
    }

    await responderOEditar(
      ctx,
      construirTextoLista(gastos, 'eliminar', { pagina, totalPages }),
      [
        ...construirTecladoLista(gastos, 'eliminar'),
        ...construirTecladoPaginacion(pagina, totalPages, 'eliminar'),
      ],
    );
  } catch (error) {
    logger.warn(
      { detalle: String(error), telegramId },
      'No se pudieron listar los gastos para eliminar en la página',
    );
    await responderOEditar(
      ctx,
      'No pude cargar esa página. Probá de nuevo con /eliminar.',
    );
  }
}

/** Callback de confirmación: borra el gasto elegido. */
export async function manejarConfirmacionEliminar(
  ctx: BotContexto,
  gastoId: number,
): Promise<void> {
  await ctx.answerCallbackQuery();
  const telegramId = String(ctx.from?.id ?? '');

  let gasto: GastoAccion;

  try {
    gasto = (await GastosService.getGastoById(
      gastoId,
      telegramId,
    )) as GastoAccion;
  } catch (error) {
    logger.warn(
      { detalle: String(error), gastoId, telegramId },
      'No se encontró el gasto a eliminar',
    );
    await responderOEditar(ctx, MENSAJE_GASTO_NO_ENCONTRADO);
    return;
  }

  try {
    await GastosService.deleteGasto(gastoId, telegramId);
    await responderOEditar(ctx, mensajeEliminado(gasto));
  } catch (error) {
    await responderErrorAccion(ctx, error, 'No se pudo eliminar el gasto');
  }
}

/** Callback del botón Cancelar. */
export async function manejarCancelarEliminar(ctx: BotContexto): Promise<void> {
  await ctx.answerCallbackQuery();
  await responderOEditar(ctx, MENSAJE_ACCION_CANCELADA);
}