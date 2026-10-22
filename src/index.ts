// bot-telegram/src/index.ts
import 'dotenv/config';
import { Bot, session } from 'grammy';
import type { Context, SessionFlavor } from 'grammy';
import type { PhotoSize } from 'grammy/types';
import { AuthService } from './services/auth.service.js';
import { GastosService } from './services/gastos.service.js';
import { IaService } from './services/ia.service.js';
import type { GastoAnalizado } from './services/ia.service.js';
import type { RangoResumen } from './dominio/rango.js';
import { logger } from './utils/logger.js';
import { crearSesionInicial } from './state/session.js';
import type { SessionData } from './state/session.js';
import {
  capturarCredenciales,
  capturarEmail,
  iniciarAutenticacion,
} from './auth.js';
import type { CredencialesCapturadas } from './auth.js';
import { aplicarEdicion } from './edicion.js';
import type { CampoEditable } from './edicion.js';
import { vistaBienvenida } from './views/bienvenida.js';
import {
  MENSAJE_CUENTA_CREADA,
  MENSAJE_CUENTA_VINCULADA,
  MENSAJE_SESION_PERDIDA,
  mensajeErrorAutenticacion,
} from './views/autenticacion.js';
import {
  MENSAJE_EDITAR,
  construirVistaPrevia,
  mensajePedirCampo,
  tecladoConfirmacion,
  tecladoEdicion,
  tecladoVolver,
} from './views/gasto-preview.js';
import {
  MENSAJE_CANCELADO,
  MENSAJE_GASTO_GUARDADO,
  MENSAJE_SIN_PENDIENTE,
  mensajeErrorGuardado,
} from './views/confirmacion.js';
import {
  MENSAJE_ANALIZANDO,
  mensajeErrorComprobante,
} from './views/comprobante.js';
import { mensajeDeError, mensajeErrorGenerico } from './views/errores.js';
import {
  mensajeNoEntendidoImagen,
  mensajeNoEntendidoTexto,
} from './views/fallbacks.js';
import { MENSAJE_ERROR_RESUMEN, formatearResumen } from './views/resumen.js';
import { MENSAJE_AYUDA } from './views/ayuda.js';
import {
  MENSAJE_CATEGORIA_INVALIDA,
  mensajeCategoriaCreada,
  mensajeErrorCategoria,
  mensajeUsoCategoria,
} from './views/categoria.js';

type BotContexto = Context & SessionFlavor<SessionData>;

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN no está definido en el archivo .env');
}

const bot = new Bot<BotContexto>(token);

bot.use(session({ initial: crearSesionInicial }));

/** Quita la botonera inline de un mensaje; ignora errores de mensajes viejos. */
async function quitarTeclado(ctx: BotContexto) {
  try {
    await ctx.editMessageReplyMarkup();
  } catch (error) {
    logger.debug({ detalle: mensajeDeError(error) }, 'No se pudo limpiar el teclado');
  }
}

/**
 * Muestra la vista previa del gasto con los botones de confirmación.
 * Distingue si el fallo proviene de un texto o de la foto de un ticket.
 */
async function pedirConfirmacion(
  ctx: BotContexto,
  gasto: GastoAnalizado,
  origen: 'texto' | 'imagen' = 'texto',
) {
  if (gasto.monto === null || Number.isNaN(gasto.monto)) {
    const aviso =
      origen === 'imagen' ? mensajeNoEntendidoImagen() : mensajeNoEntendidoTexto();
    return ctx.reply(aviso);
  }

  ctx.session.pendingExpense = gasto;
  delete ctx.session.procesando;

  return ctx.reply(construirVistaPrevia(gasto), {
    parse_mode: 'HTML',
    reply_markup: tecladoConfirmacion(),
  });
}

/** Reenvía la vista previa del gasto pendiente tras una edición. */
async function mostrarGastoPendiente(ctx: BotContexto) {
  const gasto = ctx.session.pendingExpense;

  if (!gasto) {
    return ctx.reply(MENSAJE_SIN_PENDIENTE);
  }

  delete ctx.session.editando;

  return ctx.reply(construirVistaPrevia(gasto), {
    parse_mode: 'HTML',
    reply_markup: tecladoConfirmacion(),
  });
}

/** Completa el login o registro una vez que el usuario envió sus credenciales. */
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

/**
 * Aplica la edición de un campo del gasto pendiente.
 * Devuelve true cuando el mensaje fue consumido por este flujo.
 */
async function procesarEdicion(ctx: BotContexto, texto: string): Promise<boolean> {
  const campo = ctx.session.editando;

  if (!campo || !ctx.session.pendingExpense) {
    return false;
  }

  const resultado = aplicarEdicion(ctx.session.pendingExpense, campo, texto);

  if (resultado.error) {
    await ctx.reply(resultado.error);
    return true;
  }

  ctx.session.pendingExpense = resultado.gasto;
  await ctx.reply('✅ Listo, actualicé el gasto.');
  await mostrarGastoPendiente(ctx);
  return true;
}

/** Responde un resumen a partir del rango detectado por la IA. */
async function responderResumen(
  ctx: BotContexto,
  telegramId: string,
  rango: RangoResumen | null,
) {
  try {
    const resumen = await GastosService.getSummary(telegramId, {
      ...(rango ? { rango } : {}),
    });
    await ctx.reply(formatearResumen(resumen), { parse_mode: 'HTML' });
  } catch (error) {
    logger.warn(
      { telegramId, detalle: mensajeDeError(error) },
      'No se pudo obtener el resumen de gastos',
    );
    await ctx.reply(MENSAJE_ERROR_RESUMEN);
  }
}

/** Analiza un mensaje de texto y decide cómo responder según la intención. */
async function analizarGastoTexto(ctx: BotContexto, texto: string) {
  const telegramId = String(ctx.from?.id ?? '');

  try {
    const resultado = await IaService.analizarTexto(texto);

    if (resultado.intent === 'GET_SUMMARY') {
      return await responderResumen(ctx, telegramId, resultado.rango);
    }

    if (resultado.intent === 'CREATE_CATEGORY') {
      return await crearCategoria(ctx, resultado.categoria);
    }

    await pedirConfirmacion(ctx, resultado, 'texto');
  } catch (error) {
    await ctx.reply(mensajeErrorGenerico(error));
  }
}

/** Crea una categoría nueva desde el lenguaje natural o un comando. */
async function crearCategoria(ctx: BotContexto, nombre: string | null) {
  const limpio = (nombre ?? '').trim();

  if (limpio.length < 2) {
    return ctx.reply(MENSAJE_CATEGORIA_INVALIDA);
  }

  try {
    const categoria = await GastosService.createCategory(limpio);
    await ctx.reply(mensajeCategoriaCreada(categoria.nombre), {
      parse_mode: 'HTML',
    });
  } catch (error) {
    await ctx.reply(mensajeErrorCategoria(mensajeDeError(error)));
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
async function procesarFoto(ctx: BotContexto, foto: PhotoSize | undefined) {
  try {
    await ctx.reply(MENSAJE_ANALIZANDO);

    if (!foto) {
      await ctx.reply(mensajeNoEntendidoImagen());
      return;
    }

    const buffer = await descargarComprobante(foto.file_id);
    const gasto = await IaService.analizarImagen(buffer, 'comprobante.jpg');
    await pedirConfirmacion(ctx, gasto, 'imagen');
  } catch (error) {
    await ctx.reply(mensajeErrorComprobante(mensajeDeError(error)));
  }
}

/** Muestra el menú de edición del gasto pendiente. */
async function abrirEditor(ctx: BotContexto) {
  if (!ctx.session.pendingExpense) {
    return ctx.reply(MENSAJE_SIN_PENDIENTE);
  }

  delete ctx.session.editando;

  try {
    await ctx.editMessageText(MENSAJE_EDITAR, {
      parse_mode: 'HTML',
      reply_markup: tecladoEdicion(),
    });
  } catch {
    await ctx.reply(MENSAJE_EDITAR, {
      parse_mode: 'HTML',
      reply_markup: tecladoEdicion(),
    });
  }
}

/** Pide al usuario el nuevo valor de un campo editable. */
async function pedirCampo(ctx: BotContexto, campo: CampoEditable) {
  if (!ctx.session.pendingExpense) {
    return ctx.reply(MENSAJE_SIN_PENDIENTE);
  }

  ctx.session.editando = campo;

  await ctx.editMessageText(mensajePedirCampo(campo), {
    reply_markup: tecladoVolver(),
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
  if (!ctx.from) return;
  await responderResumen(ctx, String(ctx.from.id), 'YEAR');
});

// Crea una categoría por comando: /categoria Gimnasio
bot.command('categoria', async (ctx) => {
  const nombre = ctx.match.trim();

  if (!nombre) {
    return ctx.reply(mensajeUsoCategoria());
  }

  await crearCategoria(ctx, nombre);
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

  if (ctx.session.procesando) {
    return;
  }

  const gasto = ctx.session.pendingExpense;
  const telegramId = String(ctx.from.id);

  if (!gasto) {
    return ctx.reply(MENSAJE_SIN_PENDIENTE);
  }

  ctx.session.procesando = true;
  await quitarTeclado(ctx);

  try {
    await GastosService.createExpense({
      monto: gasto.monto,
      categoria: gasto.categoria,
      comercio: gasto.comercio,
      descripcion: gasto.descripcion ?? gasto.comercio ?? '',
      fecha: gasto.fecha,
      telegramId,
    });

    delete ctx.session.pendingExpense;
    delete ctx.session.procesando;
    delete ctx.session.editando;
    await ctx.reply(MENSAJE_GASTO_GUARDADO);
  } catch (error) {
    delete ctx.session.procesando;
    await ctx.reply(mensajeErrorGuardado(mensajeDeError(error)));
  }
});

bot.callbackQuery('cancel_gasto', async (ctx) => {
  await ctx.answerCallbackQuery();

  if (ctx.session.procesando) {
    return;
  }

  ctx.session.procesando = true;
  delete ctx.session.pendingExpense;
  delete ctx.session.editando;

  await quitarTeclado(ctx);
  await ctx.editMessageText(MENSAJE_CANCELADO);
  delete ctx.session.procesando;
});

// 4. Callbacks de Edición del Gasto
bot.callbackQuery('edit_gasto', async (ctx) => {
  await ctx.answerCallbackQuery();
  await abrirEditor(ctx);
});

bot.callbackQuery('edit_volver', async (ctx) => {
  await ctx.answerCallbackQuery();
  await mostrarGastoPendiente(ctx);
});

const CAMPOS_EDICION: Array<[string, CampoEditable]> = [
  ['edit_monto', 'monto'],
  ['edit_descripcion', 'descripcion'],
  ['edit_categoria', 'categoria'],
];

for (const [callback, campo] of CAMPOS_EDICION) {
  bot.callbackQuery(callback, async (ctx) => {
    await ctx.answerCallbackQuery();
    await pedirCampo(ctx, campo);
  });
}

// 5. Manejador de Mensajes de Texto
bot.on('message:text', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const nombre = ctx.from.first_name || 'Usuario Telegram';
  const texto = ctx.message.text;

  const consumido =
    (await procesarAutenticacion(ctx, texto, telegramId, nombre)) ||
    (await procesarEdicion(ctx, texto));

  if (!consumido) {
    await analizarGastoTexto(ctx, texto);
  }
});

// 6. Manejador de Fotos (Comprobantes / Tickets)
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
