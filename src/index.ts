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
import { interpretarEdicion } from './edicion.js';
import { vistaBienvenida } from './views/bienvenida.js';
import {
  MENSAJE_CUENTA_CREADA,
  MENSAJE_CUENTA_VINCULADA,
  MENSAJE_SESION_PERDIDA,
  mensajeErrorAutenticacion,
} from './views/autenticacion.js';
import {
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
    logger.warn({ gasto, origen }, 'Gasto sin monto válido, no se pide confirmación');
    const aviso =
      origen === 'imagen' ? mensajeNoEntendidoImagen() : mensajeNoEntendidoTexto();
    return ctx.reply(aviso);
  }

  logger.info({ gasto, origen }, 'Gasto listo para confirmar');
  ctx.session.pendingExpense = gasto;
  delete ctx.session.procesando;

  return ctx.reply(construirVistaPrevia(gasto), {
    parse_mode: 'HTML',
    reply_markup: tecladoConfirmacion(),
  });
}

/** Reenvía la vista previa del gasto pendiente tras una corrección. */
async function mostrarGastoPendiente(ctx: BotContexto) {
  const gasto = ctx.session.pendingExpense;

  if (!gasto) {
    return ctx.reply(MENSAJE_SIN_PENDIENTE);
  }

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

/** Interpreta el mensaje como una corrección del gasto pendiente.
 * Si se corrige el comercio, intenta actualizar la categoría coherentemente.
 */
async function procesarEdicion(ctx: BotContexto, texto: string): Promise<boolean> {
  const gasto = ctx.session.pendingExpense;

  if (!gasto) {
    return false;
  }

  const resultado = interpretarEdicion(gasto, texto);

  if (!resultado) {
    return false;
  }

  let gastoActualizado = resultado.gasto;

  if (resultado.cambio?.includes('Comercio')) {
    try {
      const reanalizado = await IaService.analizarTexto(
        `Corregir gasto pendiente: comercio ${gastoActualizado.comercio ?? ''}, monto ${gastoActualizado.monto}, actualizar categoría coherente al nuevo comercio. Responde con el gasto actualizado en el mismo formato.`,
      );
      if (reanalizado.intent === 'CREATE_EXPENSE') {
        gastoActualizado = {
          ...gastoActualizado,
          comercio: reanalizado.comercio ?? gastoActualizado.comercio,
          categoria: reanalizado.categoria ?? gastoActualizado.categoria,
          descripcion: reanalizado.descripcion ?? gastoActualizado.descripcion,
        };
        logger.info({ reanalizado }, 'Categoría/coherencia ajustada tras cambio de comercio');
      }
    } catch (error) {
      logger.debug({ error: mensajeDeError(error) }, 'No se pudo reanalizar coherencia comercio-categoría');
    }
  }

  ctx.session.pendingExpense = gastoActualizado;
  logger.info(
    { gastoAntes: gasto, gastoNuevo: gastoActualizado, cambio: resultado.cambio },
    'Gasto pendiente corregido por lenguaje natural',
  );
  await ctx.reply(`✏️ Actualicé el gasto.\n${resultado.cambio}`);
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
    logger.info({ intento: resultado.intent, gastoIA: resultado }, 'Respuesta de IA para texto');

    if (resultado.intent === 'GET_SUMMARY') {
      return await responderResumen(ctx, telegramId, resultado.rango);
    }

    if (resultado.intent === 'CREATE_CATEGORY') {
      if (ctx.session.pendingExpense) {
        const correccion = interpretarEdicion(ctx.session.pendingExpense, texto);

        if (correccion) {
          let gastoActualizado = correccion.gasto;

          if (correccion.cambio?.includes('Comercio')) {
            try {
              const reanalizado = await IaService.analizarTexto(
                `Corregir gasto pendiente: comercio ${gastoActualizado.comercio ?? ''}, monto ${gastoActualizado.monto}. Ajustá categoría para que sea coherente con el comercio.`,
              );
              if (reanalizado.intent === 'CREATE_EXPENSE') {
                gastoActualizado = {
                  ...gastoActualizado,
                  categoria: reanalizado.categoria ?? gastoActualizado.categoria,
                };
              }
            } catch (error) {
              logger.debug({ error: mensajeDeError(error) }, 'No se pudo ajustar coherencia comercio-categoría');
            }
          }

          ctx.session.pendingExpense = gastoActualizado;
          logger.info(
            { gastoNuevo: gastoActualizado, cambio: correccion.cambio },
            'Corrección aplicada vía CREATE_CATEGORY con gasto pendiente',
          );
          await ctx.reply(`✏️ Actualicé el gasto.\n${correccion.cambio}`);
          return await mostrarGastoPendiente(ctx);
        }
      }

      return await crearCategoria(ctx, resultado.categoria);
    }

    await pedirConfirmacion(ctx, resultado, 'texto');
  } catch (error) {
    logger.error({ error: mensajeDeError(error) }, 'Error al analizar gasto con IA');
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

  await quitarTeclado(ctx);
  await ctx.editMessageText(MENSAJE_CANCELADO);
  delete ctx.session.procesando;
});

// 4. Manejador de Mensajes de Texto
bot.on('message:text', async (ctx) => {
  const telegramId = String(ctx.from.id);
  const nombre = ctx.from.first_name || 'Usuario Telegram';
  const texto = ctx.message.text;

  logger.info(
    {
      telegramId,
      nombre,
      texto,
      tienePendiente: Boolean(ctx.session.pendingExpense),
      pasoAuth: ctx.session.step ?? null,
    },
    'Mensaje de texto recibido',
  );

  const consumido =
    (await procesarAutenticacion(ctx, texto, telegramId, nombre)) ||
    (await procesarEdicion(ctx, texto));

  if (consumido) {
    logger.debug({ telegramId }, 'Mensaje consumido por flujo de autenticación o edición');
    return;
  }

  await analizarGastoTexto(ctx, texto);
});

// 5. Manejador de Fotos (Comprobantes / Tickets)
bot.on('message:photo', async (ctx) => {
  const telegramId = String(ctx.from?.id ?? '');
  logger.info({ telegramId }, 'Foto recibida para análisis');
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
    bot.api
      .setMyCommands([
        { command: 'start', description: 'Iniciar y autenticar' },
        { command: 'ayuda', description: 'Ver ayuda y comandos' },
        { command: 'categoria', description: 'Crear una categoría (ej: /categoria Comida)' },
        { command: 'resumen', description: 'Ver resumen de gastos' },
      ])
      .catch((error) => logger.warn({ error }, 'No se pudieron registrar los comandos'));
  },
});
