// bot-telegram/src/index.ts
import 'dotenv/config';
import { Bot, session, InlineKeyboard } from 'grammy';
import { AuthService } from './services/auth.service.js';
import { GastosService } from './services/gastos.service.js';
import { IaService } from './services/ia.service.js';
import type { GastoAnalizado } from './services/ia.service.js';
import { construirVistaPrevia, mensajeDeError } from './utils/format.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN no está definido en el archivo .env');
}

interface SessionData {
  step?: 'AWAITING_EMAIL' | 'AWAITING_PASSWORD';
  email?: string;
  accion?: 'LOGIN' | 'REGISTER';
  pendingExpense?: GastoAnalizado;
}

const bot = new Bot<any>(token);

bot.use(session({ initial: (): SessionData => ({}) }));

/**
 * Muestra la vista previa del gasto con los botones de confirmación.
 * Si el gasto no es utilizable, avisa al usuario con un ejemplo.
 */
async function pedirConfirmacion(ctx: any, gasto: GastoAnalizado) {
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
  ctx.session = {};
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
  ctx.session.accion = 'LOGIN';
  ctx.session.step = 'AWAITING_EMAIL';
  await ctx.answerCallbackQuery();
  await ctx.reply('📧 Por favor, ingresá tu email:');
});

bot.callbackQuery('auth_register', async (ctx) => {
  ctx.session.accion = 'REGISTER';
  ctx.session.step = 'AWAITING_EMAIL';
  await ctx.answerCallbackQuery();
  await ctx.reply('📧 Por favor, ingresá el email para tu nueva cuenta:');
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

    ctx.session.pendingExpense = undefined;
    await ctx.reply('✅ ¡Gasto registrado e impactado en tu cuenta con éxito!');
  } catch (error) {
    await ctx.reply(`❌ No se pudo guardar el gasto en api-gastos:\n${mensajeDeError(error)}`);
  }
});

bot.callbackQuery('cancel_gasto', async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.pendingExpense = undefined;
  await ctx.reply('🚫 Registro cancelado.');
});

// 4. Manejador de Mensajes de Texto
bot.on('message:text', async (ctx) => {
  const telegramId = String(ctx.from?.id);

  // Paso 1: Capturar Email
  if (ctx.session.step === 'AWAITING_EMAIL') {
    ctx.session.email = ctx.message.text.trim();
    ctx.session.step = 'AWAITING_PASSWORD';
    return ctx.reply('🔑 Ahora ingresá tu contraseña:');
  }

  // Paso 2: Capturar Contraseña y Autenticar
  if (ctx.session.step === 'AWAITING_PASSWORD') {
    const password = ctx.message.text.trim();
    const email = ctx.session.email;
    const accion = ctx.session.accion;

    ctx.session.step = undefined;

    try {
      const datos = {
        email: email ?? '',
        password,
        telegramId,
        nombre: ctx.from?.first_name || 'Usuario Telegram',
      };

      if (accion === 'LOGIN') {
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

// Iniciar bot con log activo en consola
console.log('🚀 Iniciando servicio de Telegram Bot...');
bot.start({
  onStart: (info) => {
    console.log(`✅ Bot @${info.username} iniciado con éxito y listo para recibir mensajes.`);
  },
});
