import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/gastos.service.js', () => ({
  GastosService: {
    getUltimos: vi.fn(),
    getGastoById: vi.fn(),
    updateGasto: vi.fn(),
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
  construirDatosEdicion,
  esCampoEditable,
  manejarCancelarModificar,
  manejarModificarComando,
  manejarSeleccionCampo,
  manejarSeleccionModificar,
  parsearMontoAccion,
  procesarCampoEditPendiente,
} from './modificar.js';
import { GastosService } from '../services/gastos.service.js';
import { MENSAJE_ACCION_CANCELADA } from '../views/acciones.js';

const getUltimosMock = vi.mocked(GastosService.getUltimos);
const getGastoByIdMock = vi.mocked(GastosService.getGastoById);
const updateGastoMock = vi.mocked(GastosService.updateGasto);

const GASTO = {
  id: 101,
  monto: '5000',
  descripcion: 'Gimnasio',
  fecha: '2026-11-06T16:04:19.305Z',
  categoria: { nombre: 'Salud y Bienestar' },
};

const HOY = new Date().toISOString().slice(0, 10);

type Ctx = Parameters<typeof manejarModificarComando>[0];

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

describe('esCampoEditable', () => {
  it('acepta los cuatro campos y rechaza el resto', () => {
    expect(esCampoEditable('monto')).toBe(true);
    expect(esCampoEditable('comercio')).toBe(true);
    expect(esCampoEditable('categoria')).toBe(true);
    expect(esCampoEditable('fecha')).toBe(true);
    expect(esCampoEditable('descripcion')).toBe(false);
  });
});

describe('parsearMontoAccion', () => {
  it('acepta formatos argentinos y simples', () => {
    expect(parsearMontoAccion('2500')).toBe(2500);
    expect(parsearMontoAccion('$2.500')).toBe(2500);
    expect(parsearMontoAccion('2.500,50')).toBe(2500.5);
    expect(parsearMontoAccion('2500,50')).toBe(2500.5);
    expect(parsearMontoAccion('2500.50')).toBe(2500.5);
  });

  it('rechaza valores vacíos, cero, negativos o no numéricos', () => {
    expect(parsearMontoAccion('')).toBeNull();
    expect(parsearMontoAccion('0')).toBeNull();
    expect(parsearMontoAccion('-100')).toBeNull();
    expect(parsearMontoAccion('mucho')).toBeNull();
  });
});

describe('construirDatosEdicion', () => {
  it('arma el cuerpo del PATCH para cada campo', () => {
    expect(construirDatosEdicion('monto', '2500')).toEqual({ monto: 2500 });
    expect(construirDatosEdicion('comercio', ' Coto ')).toEqual({
      comercio: 'Coto',
    });
    expect(construirDatosEdicion('categoria', 'Alimentación')).toEqual({
      categoria: 'Alimentación',
    });
    expect(construirDatosEdicion('fecha', 'hoy')).toEqual({ fecha: HOY });
  });

  it('devuelve null cuando el valor no sirve', () => {
    expect(construirDatosEdicion('monto', 'cero')).toBeNull();
    expect(construirDatosEdicion('comercio', 'a')).toBeNull();
    expect(construirDatosEdicion('categoria', '')).toBeNull();
    expect(construirDatosEdicion('fecha', 'el año pasado')).toBeNull();
  });
});

describe('manejarModificarComando', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista los últimos gastos y limpia una edición pendiente', async () => {
    getUltimosMock.mockResolvedValue({ data: [GASTO], meta: {} });
    const ctx = crearCtx();
    ctx.session.pendingCampoEdit = { gastoId: 1, campo: 'monto' };

    await manejarModificarComando(ctx);

    expect(ctx.session.pendingCampoEdit).toBeUndefined();
    expect(getUltimosMock).toHaveBeenCalledWith('1508127568', { limit: 5 });
    const [texto, opciones] = vi.mocked(ctx.reply).mock.calls[0]!;
    expect(String(texto)).toContain('#101');
    expect(opciones).toMatchObject({
      reply_markup: { inline_keyboard: expect.any(Array) },
    });
  });

  it('avisa cuando no hay gastos', async () => {
    getUltimosMock.mockResolvedValue({ data: [], meta: {} });
    const ctx = crearCtx();

    await manejarModificarComando(ctx);

    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'Todavía no tenés gastos registrados',
    );
  });

  it('avisa sin romper si la API falla', async () => {
    getUltimosMock.mockRejectedValue(new Error('sin conexión'));
    const ctx = crearCtx();

    await manejarModificarComando(ctx);

    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'No pude completar la operación',
    );
  });
});

describe('manejarSeleccionModificar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra los campos editables del gasto', async () => {
    getGastoByIdMock.mockResolvedValue(GASTO as never);
    const ctx = crearCtx({ callbackQuery: { message: {} } });

    await manejarSeleccionModificar(ctx, 101);

    expect(ctx.answerCallbackQuery).toHaveBeenCalled();
    const [texto, opciones] = vi.mocked(ctx.editMessageText).mock.calls[0]!;
    expect(String(texto)).toContain('Modificar gasto');
    const markup = (opciones as { reply_markup: { inline_keyboard: Array<Array<{ callback_data: string }>> } }).reply_markup;
    const callbacks = markup.inline_keyboard.flat().map((boton) => boton.callback_data);
    expect(callbacks).toContain('editf:101:monto');
    expect(callbacks).toContain('editf:101:fecha');
  });

  it('avisa cuando el gasto ya no existe', async () => {
    getGastoByIdMock.mockRejectedValue(new Error('404'));
    const ctx = crearCtx({ callbackQuery: { message: {} } });

    await manejarSeleccionModificar(ctx, 999);

    expect(String(vi.mocked(ctx.editMessageText).mock.calls[0]![0])).toContain(
      'No encontré ese gasto',
    );
  });
});

describe('manejarSeleccionCampo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('guarda el campo pendiente y pide el nuevo valor', async () => {
    getGastoByIdMock.mockResolvedValue(GASTO as never);
    const ctx = crearCtx({ callbackQuery: { message: {} } });

    await manejarSeleccionCampo(ctx, 101, 'monto');

    expect(ctx.session.pendingCampoEdit).toEqual({
      gastoId: 101,
      campo: 'monto',
    });
    const [texto, opciones] = vi.mocked(ctx.editMessageText).mock.calls[0]!;
    expect(String(texto)).toContain('Enviame el nuevo monto');
    expect(opciones).toMatchObject({
      reply_markup: {
        inline_keyboard: [[{ callback_data: 'editno' }]],
      },
    });
  });

  it('no guarda nada si el gasto no existe', async () => {
    getGastoByIdMock.mockRejectedValue(new Error('404'));
    const ctx = crearCtx({ callbackQuery: { message: {} } });

    await manejarSeleccionCampo(ctx, 999, 'monto');

    expect(ctx.session.pendingCampoEdit).toBeUndefined();
    expect(String(vi.mocked(ctx.editMessageText).mock.calls[0]![0])).toContain(
      'No encontré ese gasto',
    );
  });
});

describe('manejarCancelarModificar', () => {
  it('limpia el campo pendiente y cancela', async () => {
    const ctx = crearCtx({ callbackQuery: { message: {} } });
    ctx.session.pendingCampoEdit = { gastoId: 101, campo: 'fecha' };

    await manejarCancelarModificar(ctx);

    expect(ctx.session.pendingCampoEdit).toBeUndefined();
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      MENSAJE_ACCION_CANCELADA,
      expect.any(Object),
    );
  });
});

describe('procesarCampoEditPendiente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve false cuando no hay edición pendiente', async () => {
    const ctx = crearCtx();

    await expect(
      procesarCampoEditPendiente(ctx, '2500', '1508127568'),
    ).resolves.toBe(false);
    expect(updateGastoMock).not.toHaveBeenCalled();
  });

  it('actualiza el monto y limpia la sesión', async () => {
    updateGastoMock.mockResolvedValue({
      ...GASTO,
      monto: '2500',
    } as never);
    const ctx = crearCtx();
    ctx.session.pendingCampoEdit = { gastoId: 101, campo: 'monto' };

    await expect(
      procesarCampoEditPendiente(ctx, '$2.500', '1508127568'),
    ).resolves.toBe(true);

    expect(updateGastoMock).toHaveBeenCalledWith(101, '1508127568', {
      monto: 2500,
    });
    expect(ctx.session.pendingCampoEdit).toBeUndefined();
    const texto = String(vi.mocked(ctx.reply).mock.calls[0]![0]);
    expect(texto).toContain('actualizado');
    expect(texto).toContain('$2.500');
  });

  it('actualiza comercio, categoría y fecha', async () => {
    updateGastoMock.mockResolvedValue(GASTO as never);

    const casos: Array<{
      pendiente: {
        gastoId: number;
        campo: 'monto' | 'comercio' | 'categoria' | 'fecha';
      };
      texto: string;
      esperado: Record<string, unknown>;
    }> = [
      {
        pendiente: { gastoId: 101, campo: 'comercio' },
        texto: 'Coto',
        esperado: { comercio: 'Coto' },
      },
      {
        pendiente: { gastoId: 101, campo: 'categoria' },
        texto: 'Alimentación',
        esperado: { categoria: 'Alimentación' },
      },
      {
        pendiente: { gastoId: 101, campo: 'fecha' },
        texto: 'hoy',
        esperado: { fecha: HOY },
      },
    ];

    for (const { pendiente, texto, esperado } of casos) {
      const ctx = crearCtx();
      ctx.session.pendingCampoEdit = pendiente;

      await procesarCampoEditPendiente(ctx, texto, '1508127568');

      expect(updateGastoMock).toHaveBeenLastCalledWith(
        101,
        '1508127568',
        esperado,
      );
    }
  });

  it('pide un valor válido y no llama a la API', async () => {
    const ctx = crearCtx();
    ctx.session.pendingCampoEdit = { gastoId: 101, campo: 'monto' };

    await expect(
      procesarCampoEditPendiente(ctx, 'mucho', '1508127568'),
    ).resolves.toBe(true);

    expect(updateGastoMock).not.toHaveBeenCalled();
    expect(ctx.session.pendingCampoEdit).toEqual({
      gastoId: 101,
      campo: 'monto',
    });
    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'monto válido',
    );
  });

  it('consulta el gasto si la API no devuelve el cuerpo actualizado', async () => {
    updateGastoMock.mockResolvedValue({} as never);
    getGastoByIdMock.mockResolvedValue(GASTO as never);
    const ctx = crearCtx();
    ctx.session.pendingCampoEdit = { gastoId: 101, campo: 'comercio' };

    await procesarCampoEditPendiente(ctx, 'Coto', '1508127568');

    expect(getGastoByIdMock).toHaveBeenCalledWith(101, '1508127568');
    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'actualizado',
    );
  });

  it('muestra el error de la API y conserva el campo pendiente', async () => {
    updateGastoMock.mockRejectedValue(
      new Error('La categoría \'Otra\' no existe en la base de datos.'),
    );
    const ctx = crearCtx();
    ctx.session.pendingCampoEdit = { gastoId: 101, campo: 'categoria' };

    await procesarCampoEditPendiente(ctx, 'Otra', '1508127568');

    expect(ctx.session.pendingCampoEdit).toEqual({
      gastoId: 101,
      campo: 'categoria',
    });
    const texto = String(vi.mocked(ctx.reply).mock.calls[0]![0]);
    expect(texto).toContain('No pude modificar el gasto');
    expect(texto).toContain('no existe');
  });
});
