import { interpretarPeriodo } from '../dominio/periodo.js';
import type { BotContexto } from '../index.js';
import { GastosService } from '../services/gastos.service.js';
import type { OpcionesResumenBot } from '../services/gastos.service.js';
import {
  construirTituloGrafico,
  construirUrlGrafico,
  describirPeriodoGrafico,
  type PeriodoGrafico,
} from '../services/grafico.service.js';
import { MENSAJE_GRAFICO_INVALIDO } from '../views/resumen.js';

/** Sin argumentos se mantiene el comportamiento histórico: mes actual. */
const PERIODO_POR_DEFECTO: PeriodoGrafico = 'MONTH';

/**
 * Interpreta el argumento de `/grafico` con la misma sintaxis que `/resumen`:
 * hoy, semana, mes, año o fechas (por ejemplo `010126`).
 */
function interpretarPeriodoGrafico(texto: string): PeriodoGrafico | null {
  if (!texto.trim()) return PERIODO_POR_DEFECTO;

  const periodo = interpretarPeriodo(texto, new Date());
  if (!periodo) return null;

  return periodo.tipo === 'rango'
    ? periodo.rango
    : { desde: periodo.desde, hasta: periodo.hasta };
}

/** Comando: /grafico [hoy|semana|mes|año|fechas] — envía la imagen del gráfico. */
export async function manejarGraficoComando(ctx: BotContexto) {
  const args = (typeof ctx.match === 'string' ? ctx.match : '').trim();
  const periodo = interpretarPeriodoGrafico(args);

  if (!periodo) {
    await ctx.reply(MENSAJE_GRAFICO_INVALIDO, { parse_mode: 'HTML' });
    return;
  }

  const telegramId = String(ctx.from?.id ?? '');

  try {
    const opciones: OpcionesResumenBot =
      typeof periodo === 'string'
        ? { rango: periodo }
        : { desde: periodo.desde, hasta: periodo.hasta };

    const resumen = await GastosService.getSummary(telegramId, opciones);

    if (resumen.porCategoria.length === 0) {
      await ctx.reply(
        `📊 No registré gastos ${describirPeriodoGrafico(periodo)} todavía. En cuanto cargues uno, volvé a pedir el gráfico.`,
      );
      return;
    }

    const url = construirUrlGrafico(resumen, periodo);
    await ctx.replyWithPhoto(url, {
      caption: `📊 ${construirTituloGrafico(resumen, periodo)}`,
    });
  } catch (e) {
    await ctx.reply('No pude generar el gráfico. Intentá con /resumen para ver los datos.');
  }
}
