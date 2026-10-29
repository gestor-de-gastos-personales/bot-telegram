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
  construirVistaPreviaRecurrente,
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

function detectarPistaRecurrencia(texto?: string | null, gasto?: GastoAnalizado): string | null {
  const t = (texto || '').toLowerCase();
  const comercio = (gasto?.comercio || '').toLowerCase();
  const desc = (gasto?.descripcion || '').toLowerCase();
  const combinado = `${t} ${comercio} ${desc}`;

  const patrones = [
    /suscrip/i,
    /abon[oa]/i,
    /mensual/i,
    /anual/i,
    /renov/i,
    /recurrent/i,
    /se renueva/i,
    /netflix/i,
    /spotify/i,
    /disney\+/i,
    /amazon prime/i,
    /prime video/i,
    /youtube premium/i,
    /hbo/i,
    /paramount/i,
    /star\+/i,
    /apple music/i,
    /icloud/i,
    /google one/i,
    /level\s*gim/i,
    /smartfit/i,
    /gimnasio/i,
    /gym\b/i,
    /claro/i,
    /movistar/i,
    /personal/i,
    /telecentro/i,
    /fibertel/i,
    /cablevision/i,
    /flow/i,
    /direc tv/i,
    /directv/i,
    /internet\b/i,
    /luz\b/i,
    /agua\b/i,
    /gas\b/i,
  ];

  for (const p of patrones) {
    if (p.test(combinado)) {
      const m = combinado.match(p);
      if (m && m[0]) return m[0];
      return 'recurrente';
    }
  }
  return null;
}

/** Pregunta si el gasto es recurrente solo cuando hay pista de recurrencia. */
async function preguntarRecurrenciaSiCorresponde(
  ctx: BotContexto,
  gasto: GastoAnalizado,
  origen: 'texto' | 'imagen' = 'texto',
  textoOriginal?: string,
) {
  if (gasto.monto === null || Number.isNaN(gasto.monto)) {
    logger.warn({ gasto, origen }, 'Gasto sin monto válido, no se pide confirmación');
    const aviso =
      origen === 'imagen' ? mensajeNoEntendidoImagen() : mensajeNoEntendidoTexto();
    return ctx.reply(aviso);
  }

  let hint = gasto.recurringHint;
  if (!hint || !String(hint).trim()) {
    hint = detectarPistaRecurrencia(textoOriginal, gasto);
  }

  if (hint && String(hint).trim()) {
    const pista = String(hint).trim();
    ctx.session.pendingRecurringCheck = { ...gasto, origen };
    delete ctx.session.pendingExpense;
    delete ctx.session.procesando;
    await ctx.reply(
      `Vi que dijiste "${pista}". ¿Querés registrar esto como un gasto que se repite? Respondé Sí o No.`,
    );
    return;
  }

  return pedirConfirmacion(ctx, gasto, origen);
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

async function procesarFlujoRecurrente(ctx: BotContexto, texto: string, telegramId: string): Promise<boolean> {
  const paso = ctx.session.recurringStep;
  if (!paso) return false;
  if (paso === 'ASK_FREQUENCY' && !ctx.session.pendingRecurring && !ctx.session.pendingExpense) {
    return false;
  }
  if ((paso === 'ASK_IF_RECURRING' || paso === 'ASK_DAY') && !ctx.session.pendingRecurring) {
    return false;
  }

  const t = texto.toLowerCase().trim();

  if (paso === 'ASK_IF_RECURRING') {
    if (/^(si|sí|yes|s)\b/.test(t)) {
      ctx.session.recurringStep = 'ASK_FREQUENCY';
      await ctx.reply('¿Con qué frecuencia se repite? Responde: diario / semanal / mensual / anual');
      return true;
    }
    if (/^(no|n)\b/.test(t)) {
      delete ctx.session.recurringStep;
      delete ctx.session.pendingRecurring;
      await ctx.reply('Ok, no lo marco como recurrente.');
      return true;
    }
    await ctx.reply('Respondé Sí o No. ¿Este gasto se repite?');
    return true;
  }

  if (paso === 'ASK_FREQUENCY') {
    let frecuencia: 'DIARIA' | 'SEMANAL' | 'MENSUAL' | 'ANUAL' | null = null;
    if (t.includes('diar')) frecuencia = 'DIARIA';
    else if (t.includes('seman')) frecuencia = 'SEMANAL';
    else if (t.includes('mens')) frecuencia = 'MENSUAL';
    else if (t.includes('anu')) frecuencia = 'ANUAL';

    if (!frecuencia) {
      await ctx.reply('Elegí una opción: diario / semanal / mensual / anual');
      return true;
    }

    let gasto = ctx.session.pendingRecurring || ctx.session.pendingExpense;
    if (!gasto && ctx.session.pendingRecurringCheck) {
      gasto = ctx.session.pendingRecurringCheck as any;
    }
    try {
      await GastosService.createRecurrente({
        usuarioId: 0,
        telegramId,
        monto: gasto?.monto,
        comercio: gasto?.comercio,
        categoria: gasto?.categoria ?? 'Varios',
        descripcion: gasto?.descripcion ?? gasto?.comercio ?? '',
        frecuencia,
        diaMes: frecuencia === 'MENSUAL' ? new Date().getDate() : null,
        diaSemana: frecuencia === 'SEMANAL' ? new Date().getDay() : null,
      });
      delete ctx.session.recurringStep;
      delete ctx.session.pendingRecurring;
      await ctx.reply(
        `Listo. Se registrará automáticamente ${frecuencia.toLowerCase()}. Te aviso cada vez que lo registre.`,
      );
    } catch (error) {
      await ctx.reply(mensajeErrorGenerico(error));
    }
    return true;
  }

  return false;
}

async function procesarRespuestaRecurrenciaAntesDeConfirmacion(
  ctx: BotContexto,
  texto: string,
  telegramId: string,
): Promise<boolean> {
  if (!ctx.session.pendingRecurringCheck) return false;

  const t = texto.toLowerCase().trim();
  const gasto = ctx.session.pendingRecurringCheck;
  const origen = gasto.origen ?? 'texto';

  if (/^(si|sí|yes|s)\b/.test(t)) {
    delete ctx.session.pendingRecurringCheck;
    delete ctx.session.procesando;
    ctx.session.pendingRecurring = { ...gasto, telegramId, quiereRecurrente: true };
    delete (ctx.session.pendingRecurring as any).origen;
    ctx.session.pendingExpense = { ...ctx.session.pendingRecurring };
    delete (ctx.session.pendingExpense as any).origen;
    delete (ctx.session.pendingExpense as any).telegramId;
    delete (ctx.session.pendingExpense as any).quiereRecurrente;
    ctx.session.recurringStep = 'ASK_FREQUENCY';
    await ctx.reply('Lo voy a registrar como gasto recurrente.');
    await ctx.reply(construirVistaPreviaRecurrente(ctx.session.pendingExpense), {
      parse_mode: 'HTML',
    });
    await ctx.reply('¿Con qué frecuencia se repite? Responde: diario / semanal / mensual / anual');
    return true;
  }

  if (/^(no|n)\b/.test(t)) {
    const gastoComun = { ...gasto };
    delete ctx.session.pendingRecurringCheck;
    await ctx.reply('Ok, lo registro como gasto común.');
    await pedirConfirmacion(ctx, gastoComun, origen);
    return true;
  }

  await ctx.reply('Respondé Sí o No. ¿Querés registrar esto como un gasto que se repite?');
  return true;
}

function formatearFechaCorta(fecha?: string): string {
  if (!fecha) return '-';
  const s = String(fecha);
  if (s.includes('T')) return s.slice(0, 10);
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s.split('-').reverse().join('-');
  return s;
}

async function procesarEliminacion(ctx: BotContexto, texto: string, telegramId: string): Promise<boolean> {
  const t = texto.toLowerCase().trim();
  if (ctx.session.pendingDelete) {
    if (/^(si|sí|yes|s)\b/.test(t)) {
      const p = ctx.session.pendingDelete as any;
      if (!p) return false;
      try {
        await GastosService.deleteGasto(p.gastoId, telegramId);
        delete ctx.session.pendingDelete;
        await ctx.reply(`Eliminado: ${p.descripcion} - $${p.monto} (${formatearFechaCorta(p.fecha)})`);
      } catch (error) {
        await ctx.reply(mensajeDeError(error));
      }
      return true;
    }
    if (/^(no|n)\b/.test(t)) {
      delete ctx.session.pendingDelete;
      await ctx.reply('Cancelado. No se eliminó el gasto.');
      return true;
    }
    await ctx.reply('¿Eliminar este gasto? Respondé Sí o No.');
    return true;
  }

  if (/(elimina|borrar|borr[áa]|sac[áa]|quit[áa])/.test(t) && /(último|ultimo)/.test(t)) {
    let comercio: string | undefined;
    const match = t.match(/(?:de|en|del)\s+([a-záéíóúüñ0-9\s]+?)(?:\s|$)/);
    if (match && match[1]) {
      const cand = match[1].trim();
      if (cand && !/^(gasto|gastos)$/.test(cand)) comercio = cand;
    }
    try {
      const gasto: any = await GastosService.getUltimoGasto(telegramId, comercio ? { comercio } : {});
      if (!gasto || typeof gasto.id !== 'number') {
        await ctx.reply('No encontré un gasto para eliminar con esos filtros.');
        return true;
      }
      const pendiente: any = {
        gastoId: gasto.id,
        monto: Number(gasto.monto ?? 0),
        descripcion: gasto.descripcion ?? '',
        fecha: gasto.fecha ?? new Date().toISOString(),
      };
      if (gasto.categoria && gasto.categoria.nombre) pendiente.categoria = gasto.categoria.nombre;
      (ctx.session as any).pendingDelete = pendiente;
      await ctx.reply(
        `¿Eliminar este gasto?\n\n${gasto.descripcion ?? ''} - $${gasto.monto ?? 0}\nFecha: ${formatearFechaCorta(gasto.fecha)}\nCategoría: ${gasto.categoria && gasto.categoria.nombre ? gasto.categoria.nombre : '-'}`,
      );
    } catch (error) {
      await ctx.reply(mensajeDeError(error));
    }
    return true;
  }
  return false;
}

async function procesarEdicionGastoExistente(ctx: BotContexto, texto: string, telegramId: string): Promise<boolean> {
  const t = texto.toLowerCase().trim();
  if (ctx.session.pendingEdit) {
    const edicion = ctx.session.pendingEdit as any;
    const candidato = interpretarEdicion({ intent: 'CREATE_EXPENSE', monto: 0, comercio: null, categoria: null, descripcion: null, fecha: null, rango: null } as GastoAnalizado, texto);
    if (candidato?.gasto) {
      const datos: Record<string, unknown> = {};
      if (candidato.cambio?.includes('Monto') && candidato.gasto.monto !== null && candidato.gasto.monto !== undefined) {
        datos.monto = candidato.gasto.monto;
      } else {
        const m = t.match(/(?:a|por|es|son)\s*\$?\s*(\d+(?:[.,]\d+)?)/);
        if (m && m[1]) datos.monto = Number(m[1].replace(',', '.'));
      }
      if (candidato.cambio?.includes('Comercio') && candidato.gasto.comercio) {
        datos.comercio = candidato.gasto.comercio;
        datos.descripcion = candidato.gasto.comercio;
      } else {
        const c = t.match(/(?:comercio|negocio|lugar)\s+(?:a|es|por)\s+([a-záéíóúüñ0-9\s]+)/);
        if (c && c[1]) {
          const v = c[1].trim();
          if (v && !/^(monto|precio|fecha|categoria)$/.test(v)) { datos.comercio = v; datos.descripcion = v; }
        }
      }
      if (candidato.cambio?.includes('Categor') || candidato.gasto.categoria) {
        if (candidato.gasto.categoria) datos.categoria = candidato.gasto.categoria;
      }
      if (candidato.cambio?.includes('Fecha') && candidato.gasto.fecha) {
        datos.fecha = candidato.gasto.fecha;
      }
      if (Object.keys(datos).length === 0) {
        await ctx.reply('Decime el cambio que querés hacer. Ejemplo: "cambiá el monto a 8000" o "cambiá el comercio a Shell".');
        return true;
      }
      try {
        const actualizado = await GastosService.updateGasto(edicion.gastoId, telegramId, datos);
        delete ctx.session.pendingEdit;
        const desc = (actualizado as any)?.descripcion ?? datos.comercio ?? edicion?.gasto?.descripcion ?? '';
        const montoAct = (actualizado as any)?.monto ?? datos.monto ?? edicion?.gasto?.monto ?? '';
        const fechaAct = (actualizado as any)?.fecha ?? datos.fecha ?? edicion?.gasto?.fecha ?? '';
        await ctx.reply(`Actualizado.\n${desc} - $${montoAct}\nFecha: ${formatearFechaCorta(String(fechaAct))}`);
      } catch (error) {
        await ctx.reply(mensajeDeError(error));
      }
      return true;
    }
    await ctx.reply('Decime el cambio que querés hacer. Ejemplo: "cambiá el monto a 8000".');
    return true;
  }

  if (/(modific|cambi|correg|editar)/.test(t) && /(último|ultimo)/.test(t)) {
    let comercio: string | undefined;
    const match = t.match(/(?:de|en|del)\s+([a-záéíóúüñ0-9\s]+?)(?:\s+a|\s+por|\s+al|$)/);
    const comercioMatch = match && match[1] ? match[1].trim() : undefined;
    if (comercioMatch && !/^(gasto|gastos|monto|precio)$/.test(comercioMatch)) comercio = comercioMatch;
    try {
      const gasto: any = await GastosService.getUltimoGasto(telegramId, comercio ? { comercio } : {});
      if (!gasto || typeof gasto.id !== 'number') {
        await ctx.reply('No encontré un gasto para modificar con esos filtros.');
        return true;
      }
      (ctx.session as any).pendingEdit = { gastoId: gasto.id, gasto };
      await ctx.reply(
        `Gasto actual: ${gasto.descripcion ?? ''} - $${gasto.monto ?? 0} (${formatearFechaCorta(gasto.fecha)})${gasto.categoria?.nombre ? `\nCategoría: ${gasto.categoria.nombre}` : ''}\n\n¿Qué querés modificar? Escribime el cambio, por ejemplo "cambiá el monto a 8000" o "cambiá el comercio a Shell".`,
      );
      return true;
    } catch (error) {
      await ctx.reply(mensajeDeError(error));
    }
    return true;
  }
  return false;
}

async function procesarMostrarGasto(ctx: BotContexto, texto: string, telegramId: string): Promise<boolean> {
  const t = texto.toLowerCase().trim();
  if (/(ver|mostrar|consultar|mostrame)/.test(t) && /(último|ultimo)/.test(t)) {
    let comercio: string | undefined;
    const match = t.match(/(?:de|en|del)\s+([a-záéíóúüñ0-9\s]+?)$/);
    if (match && match[1]) {
      const cand = match[1].trim();
      if (cand && !/^(gasto|gastos)$/.test(cand)) comercio = cand;
    }
    try {
      const gasto: any = await GastosService.getUltimoGasto(telegramId, comercio ? { comercio } : {});
      if (!gasto || typeof gasto.id !== 'number') {
        await ctx.reply('No encontré un gasto para mostrar con esos filtros.');
        return true;
      }
      await ctx.reply(
        `Gasto #${gasto.id}\nDescripción: ${gasto.descripcion ?? '-'}\nMonto: $${gasto.monto ?? 0}\nFecha: ${formatearFechaCorta(gasto.fecha)}\nCategoría: ${gasto.categoria?.nombre ?? '-'}`,
      );
      (ctx.session as any).pendingShow = { gastoId: gasto.id, gasto };
      return true;
    } catch (error) {
      await ctx.reply(mensajeDeError(error));
    }
    return true;
  }
  return false;
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

      await ctx.reply(
        'Las categorías solo se pueden crear con el comando /categoria. Ejemplo: /categoria Comida',
      );
      return;
    }

    await preguntarRecurrenciaSiCorresponde(ctx, resultado, 'texto', texto);
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
  const telegramId = String(ctx.from?.id ?? '');
  try {
    logger.info({ telegramId }, 'Foto recibida para análisis');
    await ctx.reply(MENSAJE_ANALIZANDO);

    if (!foto) {
      await ctx.reply(mensajeNoEntendidoImagen());
      return;
    }

    const buffer = await descargarComprobante(foto.file_id);
    const gasto = await IaService.analizarImagen(buffer, 'comprobante.jpg');
    await preguntarRecurrenciaSiCorresponde(ctx, gasto, 'imagen');
  } catch (error) {
    logger.error({ error: mensajeDeError(error), telegramId }, 'Error al procesar foto');
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

    const gastoGuardado = gasto;
    delete ctx.session.pendingExpense;
    delete ctx.session.procesando;
    await ctx.reply(MENSAJE_GASTO_GUARDADO);
    // Mantener flujo de recurrencia si está en curso (pregunta previa)
    if (ctx.session.recurringStep === 'ASK_FREQUENCY' && ctx.session.pendingRecurring?.quiereRecurrente) {
      // ya se pidió la frecuencia en el flujo previo
    } else {
      delete ctx.session.recurringStep;
      delete ctx.session.pendingRecurring;
    }
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
  delete ctx.session.recurringStep;
  delete ctx.session.pendingRecurring;
  delete ctx.session.pendingRecurringCheck;
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

  if (await procesarRespuestaRecurrenciaAntesDeConfirmacion(ctx, texto, telegramId)) {
    return;
  }

  const consumido =
    (await procesarAutenticacion(ctx, texto, telegramId, nombre)) ||
    (await procesarEdicion(ctx, texto)) ||
    (await procesarFlujoRecurrente(ctx, texto, telegramId)) ||
    (await procesarMostrarGasto(ctx, texto, telegramId)) ||
    (await procesarEliminacion(ctx, texto, telegramId)) ||
    (await procesarEdicionGastoExistente(ctx, texto, telegramId));

  if (consumido) {
    logger.debug({ telegramId }, 'Mensaje consumido por flujo de autenticación o edición');
    return;
  }

  if (ctx.session.pendingExpense) {
    logger.info({ texto }, 'Mensaje sin patrón de corrección conocido, mostrando gasto pendiente');
    await ctx.reply('Ese mensaje no parece una corrección del gasto pendiente. Si querés corregir algo, escribime por ejemplo "el precio es 2500" o "fue en supermercado".');
    return await mostrarGastoPendiente(ctx);
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
