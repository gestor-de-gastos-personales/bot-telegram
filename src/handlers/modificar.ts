import type { BotContexto } from '../index.js';
import { parsearFecha } from '../dominio/fechas.js';
import { GastosService } from '../services/gastos.service.js';
import { logger } from '../utils/logger.js';
import type { CampoEditable } from '../views/acciones.js';
import {
  construirDatosEdicion,
  construirTecladoCancelar,
  construirTecladoCampos,
  construirTecladoLista,
  construirTecladoPaginacion,
  construirTextoCampoElegido,
  construirTextoDetalleModificar,
  construirTextoLista,
  calcularTotalPaginas,
  esCampoEditable,
  LIMITE_POR_PAGINA,
  MENSAJE_ACCION_CANCELADA,
  MENSAJE_GASTO_NO_ENCONTRADO,
  MENSAJE_SIN_GASTOS_ACCION,
  mensajeActualizado,
  mensajeValorInvalido,
  parsearMontoAccion,
  type GastoAccion,
} from '../views/acciones.js';

export {
  construirDatosEdicion,
  esCampoEditable,
  parsearMontoAccion,
};
import { responderErrorAccion, responderOEditar } from './comun.js';

interface RespuestaUltimos {
  data: GastoAccion[];
  meta?: { page?: number; limit?: number; total?: number; totalPages?: number };
}

/** Trae los últimos gastos del usuario paginados para elegir cuál modificar. */
async function listarUltimos(
  telegramId: string,
  pagina: number = 1,
): Promise<{ data: GastoAccion[]; total: number; totalPages: number }> {
  const respuesta = (await GastosService.getUltimos(telegramId, {
    limit: LIMITE_POR_PAGINA,
    ...(pagina > 1 ? { page: pagina } : {}),
  })) as RespuestaUltimos;

  const total = respuesta.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMITE_POR_PAGINA));

  return {
    data: respuesta.data ?? [],
    total,
    totalPages,
  };
}

/** Comando: /modificar — lista los últimos gastos con paginación estilo historial. */
export async function manejarModificarComando(ctx: BotContexto): Promise<void> {
  const telegramId = String(ctx.from?.id ?? '');
  delete ctx.session.pendingCampoEdit;

  try {
    const { data: gastos, total } = await listarUltimos(telegramId, 1);
    const totalPages = calcularTotalPaginas(total);

    if (gastos.length === 0) {
      await ctx.reply(MENSAJE_SIN_GASTOS_ACCION, { parse_mode: 'HTML' });
      return;
    }

    await ctx.reply(
      construirTextoLista(gastos, 'modificar', { pagina: 1, totalPages }),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            ...construirTecladoLista(gastos, 'modificar'),
            ...construirTecladoPaginacion(1, totalPages, 'modificar'),
          ],
        },
      },
    );
  } catch (error) {
    await responderErrorAccion(
      ctx,
      error,
      'No se pudieron listar los gastos para modificar',
    );
  }
}

/** Callback del botón de un gasto: muestra los campos editables. */
export async function manejarSeleccionModificar(
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
      construirTextoDetalleModificar(gasto),
      construirTecladoCampos(gastoId),
    );
  } catch (error) {
    logger.warn(
      { detalle: String(error), gastoId, telegramId },
      'No se pudo abrir el detalle del gasto para modificar',
    );
    await responderOEditar(ctx, MENSAJE_GASTO_NO_ENCONTRADO);
  }
}

/** Callback de paginación: cambia de página. */
export async function manejarPaginacionModificar(
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
        [
          ...construirTecladoLista(gastos, 'modificar'),
          ...construirTecladoPaginacion(pagina, totalPages, 'modificar'),
        ],
      );
      return;
    }

    await responderOEditar(
      ctx,
      construirTextoLista(gastos, 'modificar', { pagina, totalPages }),
      [
        ...construirTecladoLista(gastos, 'modificar'),
        ...construirTecladoPaginacion(pagina, totalPages, 'modificar'),
      ],
    );
  } catch (error) {
    logger.warn(
      { detalle: String(error), telegramId },
      'No se pudieron listar los gastos para modificar en la página',
    );
    await responderOEditar(
      ctx,
      'No pude cargar esa página. Probá de nuevo con /modificar.',
    );
  }
}

/** Callback de un campo: pide el nuevo valor por chat. */
export async function manejarSeleccionCampo(
  ctx: BotContexto,
  gastoId: number,
  campo: CampoEditable,
): Promise<void> {
  await ctx.answerCallbackQuery();
  const telegramId = String(ctx.from?.id ?? '');

  try {
    const gasto = (await GastosService.getGastoById(
      gastoId,
      telegramId,
    )) as GastoAccion;

    ctx.session.pendingCampoEdit = { gastoId, campo };
    await responderOEditar(
      ctx,
      construirTextoCampoElegido(gasto, campo),
      construirTecladoCancelar(),
    );
  } catch (error) {
    logger.warn(
      { detalle: String(error), gastoId, campo, telegramId },
      'No se pudo iniciar la modificación del gasto',
    );
    await responderOEditar(ctx, MENSAJE_GASTO_NO_ENCONTRADO);
  }
}

/** Callback del botón Cancelar. */
export async function manejarCancelarModificar(ctx: BotContexto): Promise<void> {
  await ctx.answerCallbackQuery();
  delete ctx.session.pendingCampoEdit;
  await responderOEditar(ctx, MENSAJE_ACCION_CANCELADA);
}

/**
 * Consume el mensaje con el nuevo valor cuando el usuario está en el flujo
 * de /modificar. Devuelve `true` cuando el mensaje ya fue procesado.
 */
export async function procesarCampoEditPendiente(
  ctx: BotContexto,
  texto: string,
  telegramId: string,
): Promise<boolean> {
  const pendiente = ctx.session.pendingCampoEdit;
  if (!pendiente) return false;

  const datos = construirDatosEdicion(pendiente.campo, texto);

  if (!datos) {
    await ctx.reply(mensajeValorInvalido(pendiente.campo), { parse_mode: 'HTML' });
    return true;
  }

  try {
    let gasto = (await GastosService.updateGasto(
      pendiente.gastoId,
      telegramId,
      datos,
    )) as GastoAccion;

    if (typeof gasto?.id !== 'number') {
      gasto = (await GastosService.getGastoById(
        pendiente.gastoId,
        telegramId,
      )) as GastoAccion;
    }

    delete ctx.session.pendingCampoEdit;
    await ctx.reply(mensajeActualizado(gasto), { parse_mode: 'HTML' });
  } catch (error) {
    logger.warn(
      {
        detalle: String(error),
        gastoId: pendiente.gastoId,
        campo: pendiente.campo,
        telegramId,
      },
      'No se pudo modificar el gasto',
    );
    await ctx.reply(
      `⚠️ No pude modificar el gasto: ${String(error)}\n\nProbá con otro valor o tocá /modificar para empezar de nuevo.`,
    );
  }

  return true;
}