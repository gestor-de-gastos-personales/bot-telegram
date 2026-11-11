import type { BotContexto } from '../index.js';
import type { GastoAnalizado } from '../services/ia.service.js';
import { GastosService } from '../services/gastos.service.js';
import {
  construirTecladoCampos,
  construirTecladoConfirmarEliminar,
  construirTextoDetalleEliminar,
  construirTextoDetalleModificar,
  mensajeActualizado,
  parsearMontoAccion,
  type GastoAccion,
} from '../views/acciones.js';
import { responderErrorAccion } from './comun.js';

const MENSAJE_SIN_COINCIDENCIAS = [
  '🤷 <b>No encontré ese gasto</b>',
  '',
  'Probá con <b>/eliminar</b> o <b>/modificar</b> para ver la lista completa.',
].join('\n');

/**
 * Busca el gasto más reciente que coincide con las pistas que dio la IA.
 * Prioriza el comercio; si no hay, usa la categoría.
 *
 * La API devuelve el último gasto aunque el filtro no coincida (fallback
 * silencioso), así que acá se valida la coincidencia antes de actuar.
 */
async function buscarGasto(
  telegramId: string,
  gasto: GastoAnalizado,
): Promise<GastoAccion | null> {
  const filtros: { comercio?: string; categoria?: string } = {};

  if (gasto.comercio) {
    filtros.comercio = gasto.comercio;
  } else if (gasto.categoria) {
    filtros.categoria = gasto.categoria;
  }

  const encontrado = (await GastosService.getUltimoGasto(
    telegramId,
    filtros,
  )) as GastoAccion | null;

  if (!encontrado || typeof encontrado.id !== 'number') return null;

  if (gasto.comercio && !coincideComercio(encontrado, gasto.comercio)) {
    return null;
  }

  if (
    !gasto.comercio &&
    gasto.categoria &&
    !coincideCategoria(encontrado, gasto.categoria)
  ) {
    return null;
  }

  return encontrado;
}

/** True si la descripción del gasto contiene el comercio buscado. */
function coincideComercio(gasto: GastoAccion, comercio: string): boolean {
  const buscado = comercio.toLowerCase().trim();
  if (!buscado) return true;
  return (gasto.descripcion ?? '').toLowerCase().includes(buscado);
}

/** True si la categoría del gasto coincide con la buscada. */
function coincideCategoria(gasto: GastoAccion, categoria: string): boolean {
  const buscada = categoria.toLowerCase().trim();
  if (!buscada) return true;
  const actual = (gasto.categoria?.nombre ?? '').toLowerCase().trim();
  return actual === buscada;
}

/** Normaliza un monto (número o texto en formato argentino). */
function montoValido(valor: unknown): number | null {
  if (valor === undefined || valor === null) return null;
  const monto =
    typeof valor === 'number' ? valor : parsearMontoAccion(String(valor));
  if (monto === null || !Number.isFinite(monto) || monto <= 0) return null;
  return monto;
}

/** Normaliza un texto recortado, con longitud mínima opcional. */
function textoValido(valor: unknown, minimo = 1): string | null {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  return texto.length >= minimo ? texto : null;
}

/** Normaliza una fecha ISO (YYYY-MM-DD). */
function fechaValida(valor: unknown): string | null {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? valor
    : null;
}

/**
 * Valida y normaliza los campos de edición que devolvió la IA
 * (`campos: { monto: 8000 }`). Ignora valores inválidos.
 */
export function normalizarCampos(
  campos: Record<string, unknown> | null | undefined,
): Record<string, string | number> | null {
  if (!campos || typeof campos !== 'object') return null;

  const datos: Record<string, string | number> = {};

  const monto = montoValido(campos.monto);
  if (monto !== null) datos.monto = monto;

  const comercio = textoValido(campos.comercio, 2);
  if (comercio) datos.comercio = comercio;

  const categoria = textoValido(campos.categoria);
  if (categoria) datos.categoria = categoria;

  const descripcion = textoValido(campos.descripcion);
  if (descripcion) datos.descripcion = descripcion;

  const fecha = fechaValida(campos.fecha);
  if (fecha) datos.fecha = fecha;

  return Object.keys(datos).length > 0 ? datos : null;
}

/**
 * Lenguaje natural → eliminar: busca el gasto y pide confirmación con el
 * mismo teclado que el flujo de /eliminar.
 */
export async function manejarEliminacionNatural(
  ctx: BotContexto,
  telegramId: string,
  gasto: GastoAnalizado,
): Promise<void> {
  try {
    const encontrado = await buscarGasto(telegramId, gasto);

    if (!encontrado) {
      await ctx.reply(MENSAJE_SIN_COINCIDENCIAS, { parse_mode: 'HTML' });
      return;
    }

    ctx.session.pendingDelete = {
      gastoId: encontrado.id,
      monto: Number(encontrado.monto ?? 0),
      descripcion: encontrado.descripcion ?? '',
      fecha: encontrado.fecha ?? new Date().toISOString(),
      ...(encontrado.categoria?.nombre
        ? { categoria: encontrado.categoria.nombre }
        : {}),
    };

    await ctx.reply(construirTextoDetalleEliminar(encontrado), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: construirTecladoConfirmarEliminar(encontrado.id),
      },
    });
  } catch (error) {
    await responderErrorAccion(
      ctx,
      error,
      'No se pudo preparar la eliminación por lenguaje natural',
    );
  }
}

/**
 * Lenguaje natural → modificar: si la IA ya extrajo los campos, aplica el
 * cambio directo; si no, abre el selector de campos de /modificar.
 */
export async function manejarEdicionNatural(
  ctx: BotContexto,
  telegramId: string,
  gasto: GastoAnalizado,
): Promise<void> {
  try {
    const encontrado = await buscarGasto(telegramId, gasto);

    if (!encontrado) {
      await ctx.reply(MENSAJE_SIN_COINCIDENCIAS, { parse_mode: 'HTML' });
      return;
    }

    const datos = normalizarCampos(gasto.campos);

    if (datos) {
      let actualizado = (await GastosService.updateGasto(
        encontrado.id,
        telegramId,
        datos,
      )) as GastoAccion;

      if (typeof actualizado?.id !== 'number') {
        actualizado = (await GastosService.getGastoById(
          encontrado.id,
          telegramId,
        )) as GastoAccion;
      }

      delete ctx.session.pendingEdit;
      await ctx.reply(mensajeActualizado(actualizado), { parse_mode: 'HTML' });
      return;
    }

    ctx.session.pendingEdit = {
      gastoId: encontrado.id,
      gasto: encontrado as unknown as Record<string, unknown>,
    };

    await ctx.reply(construirTextoDetalleModificar(encontrado), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: construirTecladoCampos(encontrado.id),
      },
    });
  } catch (error) {
    await responderErrorAccion(
      ctx,
      error,
      'No se pudo preparar la edición por lenguaje natural',
    );
  }
}
