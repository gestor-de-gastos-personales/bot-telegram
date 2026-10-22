// bot-telegram/src/index.ts
import 'dotenv/config';
import { Bot, session } from 'grammy';
import type { Context, SessionFlavor } from 'grammy';
import type { PhotoSize } from 'grammy/types';
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
import type { CredencialesCapturadas } from './auth.js';
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

/**
 * Completa el login o registro una vez que el usuario envió sus credenciales.
 */
async function vincularCuenta(
  ctx: BotContexto,
  credenciales: CredencialesCapturadas,
  telegramId: string,
  nombre: string,
) {
  const datos = {
    email: credenciales.email,
    password: credenciales.password,
    telegramId,
    nombre,
  };

  try {
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
}

/**
 * Atiende los pasos de email/contraseña del flujo de autenticación.
 * Devuelve true cuando el mensaje ya fue consumido por este flujo.
 */
async function procesarAutenticacion(
  ctx: BotContexto,
  texto: string,
  telegramId: string,
  nombre: string,
): Promise<boolean> {
  if (ctx.session.step === 'AWAITING_EMAIL') {
    await ctx.reply(capturarEmail(ctx.session, texto));
    return true;
  }

  if (ctx.session.step !== 'AWAITING_PASSWORD') {
    return false;
  }

  const credenciales = capturarCredenciales(ctx.session, texto);

  if (!credenciales) {
    await ctx.reply(MENSAJE_SESION_PERDIDA);
    return true;
  }

  await vincularCuenta(ctx, credenciales, telegramId, nombre);
  return true;
}

/** Analiza un mensaje de texto y pide confirmación del gasto detectado. */
async function analizarGastoTexto(ctx: BotContexto, texto: string) {
  try {
    const gasto = await IaService.analizarTexto(texto);
    await pedirConfirmacion(ctx, gasto);
  } catch (error) {
    await ctx.reply(mensajeErrorGenerico(error));
  }
}

/** Descarga la imagen del comprobante desde los servidores de Telegram. */
async function descargarComprobante(fileId: string): Promise<Buffer> {
  const archivo = await bot.api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${token}/${archivo.file_path}`;
  const descarga = await fetch(url);

  if (!descarga.ok) {
    throw new Error(`no se pudo descargar la imagen (${descarga.status})`);
  }

  return Buffer.from(await descarga.arrayBuffer());
}

/** Analiza una foto de comprobante y pide confirmación del gasto detectado. */
async function procesarFoto(
  ctx: BotContexto,
  foto: PhotoSize | undefined,
) {
  try {
    await ctx.reply(MENSAJE_ANALIZANDO);

    if (!foto) {
      await ctx.reply(MENSAJE_IMAGEN_ILEGIBLE);
      return;
    }

    const buffer = await descargarComprobante(foto.file_id);
    const gasto = await IaService.analizarImagen(buffer, 'comprobante.jpg');
    await pedirConfirmacion(ctx, gasto);
  } catch (error) {
    await ctx.reply(mensajeErrorComprobante(mensajeDeError(error)));
  }
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
    logger.warn(
      {
        telegramId: String(usuario.id),
        detalle: mensajeDeError(error),
      },
      'No se pudo obtener el resumen de gastos',
    );
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
  const nombre = ctx.from.first_name || 'Usuario Telegram';
  const texto = ctx.message.text;

  const consumido = await procesarAutenticacion(
    ctx,
    texto,
    telegramId,
    nombre,
  );

  if (!consumido) {
    await analizarGastoTexto(ctx, texto);
  }
});

// 5. Manejador de Fotos (Comprobantes / Tickets)
bot.on('message:photo', async (ctx) => {
  await procesarFoto(ctx, ctx.message.photo.at(-1));
});

// Iniciar bot con logging estructurado
logger.info('Iniciando servicio de Telegram Bot');

bot.start({
  onStart: (info) => {
    logger.info(
      { username: info.username },
      'Bot iniciado y listo para recibir mensajes',
    );
  },
});
