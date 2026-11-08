import type { BotContexto } from '../index.js';
import { logger } from '../utils/logger.js';
import { mensajeDeError } from '../views/errores.js';
import { MENSAJE_ERROR_ACCION } from '../views/acciones.js';
import type { BotonInline } from '../views/teclado.js';

/**
 * Responde editando el mensaje del callback cuando es posible.
 *
 * Si el mensaje es viejo, ya no existe o no se puede editar, envía uno nuevo.
 * Un doble clic sobre el mismo botón no duplica la respuesta: Telegram avisa
 * "message is not modified" y se ignora.
 */
export async function responderOEditar(
  ctx: BotContexto,
  texto: string,
  teclado?: BotonInline[][],
): Promise<void> {
  const opciones =
    teclado && teclado.length > 0
      ? {
          parse_mode: 'HTML' as const,
          reply_markup: { inline_keyboard: teclado },
        }
      : { parse_mode: 'HTML' as const };

  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(texto, opciones);
      return;
    } catch (error) {
      const detalle = mensajeDeError(error);

      if (/message is not modified/i.test(detalle)) {
        return;
      }

      logger.warn(
        { detalle },
        'No se pudo editar el mensaje de la acción; se envía uno nuevo',
      );
    }
  }

  await ctx.reply(texto, opciones);
}

/** Registra el fallo y avisa al usuario sin exponer detalles internos. */
export async function responderErrorAccion(
  ctx: BotContexto,
  error: unknown,
  contexto: string,
): Promise<void> {
  logger.error({ detalle: mensajeDeError(error) }, contexto);
  await ctx.reply(MENSAJE_ERROR_ACCION, { parse_mode: 'HTML' });
}
