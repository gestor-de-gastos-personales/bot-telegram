// bot-telegram/src/index.ts
import 'dotenv/config';
import { Bot, session, InlineKeyboard } from 'grammy';
import type { Context, SessionFlavor } from 'grammy';
import { AuthService } from './services/auth.service.js';
import { GastosService } from './services/gastos.service.js';
import { IaService } from './services/ia.service.js';
import type { GastoAnalizado } from './services/ia.service.js';
import { construirVistaPrevia, mensajeDeError } from './utils/format.js';
import { logger } from './utils/logger.js';
import { crearSesionInicial } from './state/session.js';
import type { SessionData } from './state/session.js';
import {
  capturarCredenciales,
  capturarEmail,
  iniciarAutenticacion,
} from './auth.js';

type BotContexto = Context & SessionFlavor<SessionData>;

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN no está definido en el archivo .env');
}

const bot = new Bot<BotContexto>(token);

bot.use(session({ initial: crearSesionInicial }));

/**
 * Muestra la vista previa del gasto con los botones de confirmación.
 * Si el gasto no es utilizable, avisa al usuario con un ejemplo.
 */
async function pedirConfirmacion(ctx: BotContexto, gasto: GastoAnalizado) {
  if (gasto.monto === null || Number.isNaN(gasto.monto)) {
    return ctx.reply(
      '🤖 No pude identificar un gasto válido. Ejemplo: "Gasté 200 en un colectivo"',
    );
  }

  ctx.session.pendingExpense = gasto;

  const keyboard = new InlineKeyboard()
    .text('✅ Confirmar y Guardar', 'confirm_gasto')
    .text('❌ Cancelar', 'cancel_gasto');

  return ctx.reply(construirVistaPrevia(gasto), {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

// 1. Comando /start
bot.command('start', async (ctx) => {
  ctx.session = crearSesionInicial();
  await ctx.reply(
    '👋 ¡Bienvenido a Mangos!\n\nPara comenzar a registrar tus gastos, identificáte o creá tu cuenta:',
    {
      reply_markup: new InlineKeyboard()
        .text('🔑 Iniciar Sesión', 'auth_login')
        .text('📝 Registrarme', 'auth_register'),
    },
  );
});

// 2. Callbacks de Autenticación
bot.callbackQuery('auth_login', async (ctx) => {
  const mensaje = iniciarAutenticacion(ctx.session, 'LOGIN');
  await ctx.answerCallbackQuery();
  await ctx.reply(mensaje);
});

bot.callbackQuery('auth_register', async (ctx) => {
  const mensaje = iniciarAutenticacion(ctx.session, 'REGISTER');
  await ctx.answerCallbackQuery();
  await ctx.reply(mensaje);
});

// 3. Callbacks de Confirmación de Gastos
bot.callbackQuery('confirm_gasto', async (ctx) => {
  await ctx.answerCallbackQuery();
  const gasto = ctx.session.pendingExpense;
  const telegramId = String(ctx.from.id);

  if (!gasto) {
    return ctx.reply('⚠️ No hay ningún gasto pendiente por confirmar.');
  }

  try {
    await GastosService.createExpense({
      monto: gasto.monto,
      categoria: gasto.categoria,
      comercio: gasto.comercio,
      descripcion: gasto.descripcion ?? gasto.comercio ?? '',
      telegramId,
    });

    delete ctx.session.pendingExpense;
    await ctx.reply('✅ ¡Gasto registrado e impactado en tu cuenta con éxito!');
  } catch (error) {
    await ctx.reply(
      `❌ No se pudo guardar el gasto en api-gastos:\n${mensajeDeError(error)}`,
    );
  }
});

bot.callbackQuery('cancel_gasto', async (ctx) => {
  await ctx.answerCallbackQuery();
  delete ctx.session.pendingExpense;
  await ctx.reply('🚫 Registro cancelado.');
});

// 4. Manejador de Mensajes de Texto
bot.on('message:text', async (ctx) => {
  const telegramId = String(ctx.from?.id);

  // Paso 1: Capturar Email
  if (ctx.session.step === 'AWAITING_EMAIL') {
    return ctx.reply(capturarEmail(ctx.session, ctx.message.text));
  }

  // Paso 2: Capturar Contraseña y Autenticar
  if (ctx.session.step === 'AWAITING_PASSWORD') {
    const credenciales = capturarCredenciales(ctx.session, ctx.message.text);

    if (!credenciales) {
      return ctx.reply('⚠️ No pude recuperar tus datos. Reintentá con /start');
    }

    try {
      const datos = {
        email: credenciales.email,
        password: credenciales.password,
        telegramId,
        nombre: ctx.from?.first_name || 'Usuario Telegram',
      };

      if (credenciales.accion === 'LOGIN') {
        await AuthService.vincularTelegram(datos);
        await ctx.reply(
          '✅ ¡Cuenta vinculada exitosamente! Ya podés registrar tus gastos enviándome mensajes.',
        );
      } else {
        await AuthService.registrarTelegram(datos);
        await ctx.reply(
          '✅ ¡Cuenta creada y vinculada con éxito! Ya podés registrar tus gastos enviándome mensajes.',
        );
      }
    } catch (error) {
      await ctx.reply(
        `❌ Error: ${mensajeDeError(error)}. Reintentá con /start`,
      );
    }
    return;
  }

  // Paso 3: Análisis de Gastos mediante Servicio IA
  try {
    const gasto = await IaService.analizarTexto(ctx.message.text);
    await pedirConfirmacion(ctx, gasto);
  } catch (error) {
    await ctx.reply(`⚠️ ${mensajeDeError(error)}`);
  }
});

// 5. Manejador de Fotos (Comprobantes / Tickets)
bot.on('message:photo', async (ctx) => {
  try {
    await ctx.reply('🧾 Analizando tu comprobante, un momento...');

    // Se usa la foto de mayor resolución disponible.
    const foto = ctx.message.photo[ctx.message.photo.length - 1];
    if (!foto) {
      return ctx.reply('⚠️ No pude leer la imagen enviada. Probá de nuevo.');
    }

    const archivo = await ctx.api.getFile(foto.file_id);

    const descarga = await fetch(
      `https://api.telegram.org/file/bot${token}/${archivo.file_path}`,
    );

    if (!descarga.ok) {
      throw new Error(`no se pudo descargar la imagen (${descarga.status})`);
    }

    const buffer = Buffer.from(await descarga.arrayBuffer());
    const gasto = await IaService.analizarImagen(buffer, 'comprobante.jpg');

    await pedirConfirmacion(ctx, gasto);
  } catch (error) {
    await ctx.reply(`⚠️ ${mensajeDeError(error)}`);
  }
});

// Iniciar bot con logging estructurado
logger.info('Iniciando servicio de Telegram Bot');

bot.start({
  onStart: (info) => {
    logger.info('Bot iniciado y listo para recibir mensajes', {
      username: info.username,
    });
  },
});
