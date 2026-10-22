// bot-telegram/src/index.ts
import 'dotenv/config';
import { Bot, session } from 'grammy';
import type { Context, SessionFlavor } from 'grammy';
import { AuthService } from './services/auth.service.js';
import { GastosService } from './services/gastos.service.js';
import { IaService } from './services/ia.service.js';
import type { GastoAnalizado } from './services/ia.service.js';
import { logger } from './utils/logger.js';
import { crearSesionInicial } from './state/session.js';
import type { SessionData } from './state/session.js';
import {
  capturarCredenciales,
  capturarEmail,
  iniciarAutenticacion,
} from './auth.js';
import { vistaBienvenida } from './views/bienvenida.js';
import {
  MENSAJE_CUENTA_CREADA,
  MENSAJE_CUENTA_VINCULADA,
  MENSAJE_SESION_PERDIDA,
  mensajeErrorAutenticacion,
} from './views/autenticacion.js';
import {
  MENSAJE_GASTO_INVALIDO,
  construirVistaPrevia,
  tecladoConfirmacion,
} from './views/gasto-preview.js';
import {
  MENSAJE_CANCELADO,
  MENSAJE_GASTO_GUARDADO,
  MENSAJE_SIN_PENDIENTE,
  mensajeErrorGuardado,
} from './views/confirmacion.js';
import {
  MENSAJE_ANALIZANDO,
  MENSAJE_IMAGEN_ILEGIBLE,
  mensajeErrorComprobante,
} from './views/comprobante.js';
import { mensajeDeError, mensajeErrorGenerico } from './views/errores.js';
import { MENSAJE_ERROR_RESUMEN, formatearResumen } from './views/resumen.js';
import { MENSAJE_AYUDA } from './views/ayuda.js';

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
    return ctx.reply(MENSAJE_GASTO_INVALIDO);
  }

  ctx.session.pendingExpense = gasto;

  return ctx.reply(construirVistaPrevia(gasto), {
    parse_mode: 'HTML',
    reply_markup: tecladoConfirmacion(),
  });
}

// 1. Comandos de bienvenida y ayuda
bot.command('start', async (ctx) => {
  ctx.session = crearSesionInicial();
  const vista = vistaBienvenida();
  await ctx.reply(vista.texto, { reply_markup: vista.teclado });
});

bot.command('ayuda', async (ctx) => {
  await ctx.reply(MENSAJE_AYUDA, { parse_mode: 'HTML' });
});

bot.command('resumen', async (ctx) => {
  const usuario = ctx.from;
  if (!usuario) {
    return;
  }

  try {
    const resumen = await GastosService.getSummary(String(usuario.id));
    await ctx.reply(formatearResumen(resumen), { parse_mode: 'HTML' });
  } catch (error) {
    logger.warn('No se pudo obtener el resumen de gastos', {
      telegramId: String(usuario.id),
      detalle: mensajeDeError(error),
    });
    await ctx.reply(MENSAJE_ERROR_RESUMEN);
  }
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
    return ctx.reply(MENSAJE_SIN_PENDIENTE);
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
    await ctx.reply(MENSAJE_GASTO_GUARDADO);
  } catch (error) {
    await ctx.reply(mensajeErrorGuardado(mensajeDeError(error)));
  }
});

bot.callbackQuery('cancel_gasto', async (ctx) => {
  await ctx.answerCallbackQuery();
  delete ctx.session.pendingExpense;
  await ctx.reply(MENSAJE_CANCELADO);
});

// 4. Manejador de Mensajes de Texto
bot.on('message:text', async (ctx) => {
  const telegramId = String(ctx.from.id);

  // Paso 1: Capturar Email
  if (ctx.session.step === 'AWAITING_EMAIL') {
    return ctx.reply(capturarEmail(ctx.session, ctx.message.text));
  }

  // Paso 2: Capturar Contraseña y Autenticar
  if (ctx.session.step === 'AWAITING_PASSWORD') {
    const credenciales = capturarCredenciales(ctx.session, ctx.message.text);

    if (!credenciales) {
      return ctx.reply(MENSAJE_SESION_PERDIDA);
    }

    try {
      const datos = {
        email: credenciales.email,
        password: credenciales.password,
        telegramId,
        nombre: ctx.from.first_name || 'Usuario Telegram',
      };

      if (credenciales.accion === 'LOGIN') {
        await AuthService.vincularTelegram(datos);
        await ctx.reply(MENSAJE_CUENTA_VINCULADA);
      } else {
        await AuthService.registrarTelegram(datos);
        await ctx.reply(MENSAJE_CUENTA_CREADA);
      }
    } catch (error) {
      await ctx.reply(mensajeErrorAutenticacion(mensajeDeError(error)));
    }
    return;
  }

  // Paso 3: Análisis de Gastos mediante Servicio IA
  try {
    const gasto = await IaService.analizarTexto(ctx.message.text);
    await pedirConfirmacion(ctx, gasto);
  } catch (error) {
    await ctx.reply(mensajeErrorGenerico(error));
  }
});

// 5. Manejador de Fotos (Comprobantes / Tickets)
bot.on('message:photo', async (ctx) => {
  try {
    await ctx.reply(MENSAJE_ANALIZANDO);

    // Se usa la foto de mayor resolución disponible.
    const foto = ctx.message.photo.at(-1);
    if (!foto) {
      return ctx.reply(MENSAJE_IMAGEN_ILEGIBLE);
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
    await ctx.reply(mensajeErrorComprobante(mensajeDeError(error)));
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
