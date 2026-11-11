import type { BotContexto } from '../index.js';
import { formatearFechaES, parsearRango } from '../dominio/fechas.js';
import { interpretarPeriodo } from '../dominio/periodo.js';
import type { RangoResumen } from '../dominio/rango.js';
import { GastosService } from '../services/gastos.service.js';
import { logger } from '../utils/logger.js';
import { mensajeDeError } from '../views/errores.js';
import {
  AVISO_RANGO_INVERTIDO,
  MENSAJE_ERROR_RESUMEN,
  MENSAJE_FECHA_INVALIDA,
  PISTA_RANGO,
  formatearResumen,
} from '../views/resumen.js';

/**
 * Responde un resumen.
 *
 * Con `rango` usa los períodos predefinidos (hoy, semana, mes, año).
 * Con `desde`/`hasta` muestra el rango de fechas que escribió el usuario.
 */
export async function responderResumen(
  ctx: BotContexto,
  telegramId: string,
  rango: RangoResumen | null,
  desde?: string,
  hasta?: string,
  nota?: string,
): Promise<void> {
  try {
    const resumen = await GastosService.getSummary(telegramId, {
      ...(rango ? { rango } : {}),
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
    });

    const titulo =
      desde && hasta
        ? `Resumen del ${formatearFechaES(desde)} al ${formatearFechaES(hasta)}`
        : undefined;

    await ctx.reply(
      `${nota ? `${nota}\n\n` : ''}${formatearResumen(resumen, titulo ? { titulo } : {})}\n\n${PISTA_RANGO}`,
      { parse_mode: 'HTML' },
    );
  } catch (error) {
    logger.warn(
      { telegramId, detalle: mensajeDeError(error) },
      'No se pudo obtener el resumen de gastos',
    );
    await ctx.reply(MENSAJE_ERROR_RESUMEN, { parse_mode: 'HTML' });
  }
}

/**
 * Comando `/resumen [período]`.
 *
 * Sin argumentos muestra el año actual. Acepta las palabras `hoy`, `semana`,
 * `mes` y `año`, o fechas escritas (por ejemplo `011226 311226`).
 * Si no se entiende, explica el formato.
 */
export async function manejarResumenComando(ctx: BotContexto): Promise<void> {
  const telegramId = String(ctx.from?.id ?? '');
  const argumento = typeof ctx.match === 'string' ? ctx.match.trim() : '';

  if (!argumento) {
    await responderResumen(ctx, telegramId, 'YEAR');
    return;
  }

  const periodo = interpretarPeriodo(argumento, new Date());

  if (!periodo) {
    await ctx.reply(MENSAJE_FECHA_INVALIDA, { parse_mode: 'HTML' });
    return;
  }

  if (periodo.tipo === 'rango') {
    await responderResumen(ctx, telegramId, periodo.rango);
    return;
  }

  await responderResumen(
    ctx,
    telegramId,
    null,
    periodo.desde,
    periodo.hasta,
    periodo.invertido ? AVISO_RANGO_INVERTIDO : undefined,
  );
}

/**
 * Resumen pedido en texto libre: si la IA no detectó un rango predefinido,
 * se intenta interpretar un rango de fechas escrito por el usuario.
 */
export async function responderResumenPorTexto(
  ctx: BotContexto,
  telegramId: string,
  rango: RangoResumen | null,
  texto: string,
): Promise<void> {
  if (!rango) {
    const rangoFechas = parsearRango(texto, new Date());
    if (rangoFechas) {
      await responderResumen(
        ctx,
        telegramId,
        null,
        rangoFechas.desde,
        rangoFechas.hasta,
        rangoFechas.invertido ? AVISO_RANGO_INVERTIDO : undefined,
      );
      return;
    }
  }

  await responderResumen(ctx, telegramId, rango);
}
