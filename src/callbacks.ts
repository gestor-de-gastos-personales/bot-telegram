/**
 * Callbacks de los comandos interactivos de gastos: /eliminar, /modificar
 * y /historial.
 *
 * Viven en su propio módulo para poder testear el REGISTRO de los callbacks
 * (que es donde fallaba la paginación: los handlers existían pero ningún
 * `bot.callbackQuery` los conectaba).
 */
import type { Bot } from 'grammy';
import type { BotContexto } from './index.js';
import {
  manejarCancelarEliminar,
  manejarConfirmacionEliminar,
  manejarPaginacionEliminar,
  manejarSeleccionEliminar,
} from './handlers/eliminar.js';
import {
  manejarCancelarModificar,
  manejarPaginacionModificar,
  manejarSeleccionCampo,
  manejarSeleccionModificar,
} from './handlers/modificar.js';
import { manejarCallbackHistorial, manejarHistorialComando } from './handlers/historial.js';
import { manejarGraficoComando } from './handlers/grafico.js';
import { manejarEliminarComando } from './handlers/eliminar.js';
import { manejarModificarComando } from './handlers/modificar.js';
import { responderResumen } from './handlers/resumen.js';
import type { CampoEditable } from './views/acciones.js';
import type { ComandoRapido } from './views/comandos.js';
import { MENSAJE_AYUDA, construirTecladoAyudaRapido } from './views/ayuda.js';

/** Registra en el bot los callbacks de /eliminar, /modificar y /historial. */
export function registrarCallbacksDeAcciones(bot: Bot<BotContexto>): void {
  // Callbacks de /eliminar
  bot.callbackQuery(/^del:(\d+)$/, async (ctx) => {
    const gastoId = Number(ctx.match[1]);
    await manejarSeleccionEliminar(ctx, gastoId);
  });

  bot.callbackQuery(/^delok:(\d+)$/, async (ctx) => {
    const gastoId = Number(ctx.match[1]);
    await manejarConfirmacionEliminar(ctx, gastoId);
  });

  bot.callbackQuery('delno', async (ctx) => {
    await manejarCancelarEliminar(ctx);
  });

  // Callbacks de /modificar
  bot.callbackQuery(/^edit:(\d+)$/, async (ctx) => {
    const gastoId = Number(ctx.match[1]);
    await manejarSeleccionModificar(ctx, gastoId);
  });

  bot.callbackQuery(
    /^editf:(\d+):(monto|comercio|categoria|fecha)$/,
    async (ctx) => {
      const gastoId = Number(ctx.match[1]);
      const campo = ctx.match[2] as CampoEditable;
      await manejarSeleccionCampo(ctx, gastoId, campo);
    },
  );

  bot.callbackQuery('editno', async (ctx) => {
    await manejarCancelarModificar(ctx);
  });

  // Callbacks de paginación de /eliminar y /modificar.
  // El formato es `pagina:<accion>:<numero>` para saber a qué lista pertenece.
  bot.callbackQuery(/^pagina:(eliminar|modificar):(\d+)$/, async (ctx) => {
    const accion = ctx.match[1] as 'eliminar' | 'modificar';
    const pagina = Number(ctx.match[2]);

    if (accion === 'eliminar') {
      await manejarPaginacionEliminar(ctx, pagina);
      return;
    }

    await manejarPaginacionModificar(ctx, pagina);
  });

  // Botón informativo de página: solo confirma el toque, no cambia nada.
  bot.callbackQuery(/^pagina:(eliminar|modificar):noop$/, async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  // Callbacks de paginación de /historial (`hist:<numero>`).
  bot.callbackQuery(/^hist:(\d+)$/, async (ctx) => {
    const pagina = Number(ctx.match[1]);
    await manejarCallbackHistorial(ctx, pagina);
  });

  bot.callbackQuery('hist:noop', async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  // Accesos rápidos: botones que ejecutan un comando sin escribirlo.
  bot.callbackQuery(
    /^cmd:(resumen|historial|grafico|eliminar|modificar|ayuda)$/,
    async (ctx) => {
      const comando = ctx.match[1] as ComandoRapido;
      await ctx.answerCallbackQuery();

      // El mensaje original conserva su teclado: el usuario puede probar
      // más de una opción sin tener que volver a abrir la ayuda.
      const telegramId = String(ctx.from?.id ?? '');

      switch (comando) {
        case 'resumen':
          await responderResumen(ctx, telegramId, 'YEAR');
          return;
        case 'historial':
          await manejarHistorialComando(ctx);
          return;
        case 'grafico':
          await manejarGraficoComando(ctx);
          return;
        case 'eliminar':
          await manejarEliminarComando(ctx);
          return;
        case 'modificar':
          await manejarModificarComando(ctx);
          return;
        case 'ayuda':
          await ctx.reply(MENSAJE_AYUDA, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: construirTecladoAyudaRapido() },
          });
          return;
      }
    },
  );
}
