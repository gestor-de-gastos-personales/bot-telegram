import { Bot } from 'grammy';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('Error: TELEGRAM_BOT_TOKEN no está definido en el archivo .env');
  process.exit(1);
}

const bot = new Bot(token);

// Respuesta al comando /start
bot.command('start', (ctx) => {
  return ctx.reply('👋 ¡Hola! Soy tu gestor de gastos con IA.\n\nEnvíame una foto de un ticket o factura para registrar un gasto automáticamente.');
});

// Listener básico para fotos
bot.on('message:photo', (ctx) => {
  return ctx.reply('📸 Foto recibida. En el próximo sprint procesaremos este ticket con el servicio de IA.');
});

// Iniciar bot (Long Polling)
bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} iniciado exitosamente.`);
  },
});