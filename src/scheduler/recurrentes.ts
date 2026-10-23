import cron from 'node-cron';
import { GastosService } from '../services/gastos.service.js';
import { logger } from '../utils/logger.js';
import { Bot } from 'grammy';
import type { Context, SessionFlavor } from 'grammy';
import type { SessionData } from '../state/session.js';

type BotContexto = Context & SessionFlavor<SessionData>;

export function iniciarScheduler(bot: Bot<BotContexto>) {
  cron.schedule('0 * * * *', async () => {
    try {
      const vencidas = await GastosService.getRecurrentesVencidas();
      for (const regla of vencidas) {
        try {
          const gasto = await GastosService.ejecutarRecurrente(regla.id);
          const telegramId = (regla as { usuario?: { telegramId?: string } }).usuario?.telegramId;
          if (telegramId && gasto) {
            const g = gasto as { monto: number; descripcion: string; fecha?: string };
            await bot.api.sendMessage(
              telegramId,
              `✅ Se registró automáticamente la suscripción de ${regla.descripcion || g.descripcion} - $${g.monto} (${g.fecha?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)})`,
            );
          }
        } catch (error) {
          logger.error({ error, reglaId: regla.id }, 'Error al ejecutar gasto recurrente');
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error al buscar gastos recurrentes vencidos');
    }
  });

  logger.info('Scheduler de gastos recurrentes iniciado');
}
