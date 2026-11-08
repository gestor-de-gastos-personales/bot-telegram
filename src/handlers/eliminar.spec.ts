import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/gastos.service.js', () => ({
  GastosService: {
    getUltimos: vi.fn(),
    getGastoById: vi.fn(),
    deleteGasto: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  manejarCancelarEliminar,
  manejarConfirmacionEliminar,
  manejarEliminarComando,
  manejarSeleccionEliminar,
} from './eliminar.js';
import { GastosService } from '../services/gastos.service.js';
import { MENSAJE_ACCION_CANCELADA } from '../views/acciones.js';

const getUltimosMock = vi.mocked(GastosService.getUltimos);
const getGastoByIdMock = vi.mocked(GastosService.getGastoById);
const deleteGastoMock = vi.mocked(GastosService.deleteGasto);

const GASTOS = [
  {
    id: 101,
    monto: '5000',
    descripcion: 'Gimnasio',
    fecha: '2026-11-06T16:04:19.305Z',
    categoria: { nombre: 'Salud y Bienestar' },
  },
  {
    id: 100,
    monto: '3767',
    descripcion: 'Otros gastos - Varios',
    fecha: '2026-11-05T12:00:00.000Z',
    categoria: { nombre: 'Otros / Varios' },
  },
];

type Ctx = Parameters<typeof manejarEliminarComando>[0];

function crearCtx(over: Record<string, unknown> = {}): Ctx {
  return {
    from: { id: 1508127568 },
    session: {},
    reply: vi.fn(),
    editMessageText: vi.fn(),
    answerCallbackQuery: vi.fn(),
    ...over,
  } as unknown as Ctx;
}

describe('manejarEliminarComando', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista los últimos gastos con un botón por gasto', async () => {
    getUltimosMock.mockResolvedValue({ data: GASTOS, meta: {} });
    const ctx = crearCtx();

    await manejarEliminarComando(ctx);

    expect(getUltimosMock).toHaveBeenCalledWith('1508127568', { limit: 5 });
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [texto, opciones] = vi.mocked(ctx.reply).mock.calls[0]!;
    expect(String(texto)).toContain('#101');
    expect(opciones).toMatchObject({
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: expect.any(Array) },
    });
  });

  it('avisa cuando no hay gastos', async () => {
    getUltimosMock.mockResolvedValue({ data: [], meta: {} });
    const ctx = crearCtx();

    await manejarEliminarComando(ctx);

    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'Todavía no tenés gastos registrados',
    );
  });

  it('avisa sin romper si la API falla', async () => {
    getUltimosMock.mockRejectedValue(new Error('sin conexión'));
    const ctx = crearCtx();

    await manejarEliminarComando(ctx);

    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'No pude completar la operación',
    );
  });
});

describe('manejarSeleccionEliminar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el detalle con los botones de confirmación', async () => {
    getGastoByIdMock.mockResolvedValue(GASTOS[0] as never);
    const ctx = crearCtx({ callbackQuery: { message: {} } });

    await manejarSeleccionEliminar(ctx, 101);

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(getGastoByIdMock).toHaveBeenCalledWith(101, '1508127568');
    const [texto, opciones] = vi.mocked(ctx.editMessageText).mock.calls[0]!;
    expect(String(texto)).toContain('no se puede deshacer');
    const markup = (opciones as { reply_markup: { inline_keyboard: Array<Array<{ callback_data: string }>> } }).reply_markup;
    expect(markup.inline_keyboard[0]?.[0]?.callback_data).toBe('delok:101');
    expect(markup.inline_keyboard[0]?.[1]?.callback_data).toBe('delno');
  });

  it('avisa cuando el gasto ya no existe', async () => {
    getGastoByIdMock.mockRejectedValue(new Error('404'));
    const ctx = crearCtx({ callbackQuery: { message: {} } });

    await manejarSeleccionEliminar(ctx, 999);

    expect(String(vi.mocked(ctx.editMessageText).mock.calls[0]![0])).toContain(
      'No encontré ese gasto',
    );
  });
});

describe('manejarConfirmacionEliminar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('elimina el gasto y confirma con su detalle', async () => {
    getGastoByIdMock.mockResolvedValue(GASTOS[0] as never);
    deleteGastoMock.mockResolvedValue({ ok: true } as never);
    const ctx = crearCtx({ callbackQuery: { message: {} } });

    await manejarConfirmacionEliminar(ctx, 101);

    expect(deleteGastoMock).toHaveBeenCalledWith(101, '1508127568');
    const texto = String(vi.mocked(ctx.editMessageText).mock.calls[0]![0]);
    expect(texto).toContain('Gasto eliminado');
    expect(texto).toContain('#101');
    expect(texto).toContain('$5.000');
  });

  it('no intenta borrar si el gasto no existe', async () => {
    getGastoByIdMock.mockRejectedValue(new Error('404'));
    const ctx = crearCtx({ callbackQuery: { message: {} } });

    await manejarConfirmacionEliminar(ctx, 999);

    expect(deleteGastoMock).not.toHaveBeenCalled();
    expect(String(vi.mocked(ctx.editMessageText).mock.calls[0]![0])).toContain(
      'No encontré ese gasto',
    );
  });

  it('avisa si la API falla al borrar', async () => {
    getGastoByIdMock.mockResolvedValue(GASTOS[0] as never);
    deleteGastoMock.mockRejectedValue(new Error('500'));
    const ctx = crearCtx({ callbackQuery: { message: {} } });

    await manejarConfirmacionEliminar(ctx, 101);

    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'No pude completar la operación',
    );
  });
});

describe('manejarCancelarEliminar', () => {
  it('edita el mensaje con la cancelación', async () => {
    const ctx = crearCtx({ callbackQuery: { message: {} } });

    await manejarCancelarEliminar(ctx);

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      MENSAJE_ACCION_CANCELADA,
      expect.any(Object),
    );
  });
});
