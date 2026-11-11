import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/gastos.service.js', () => ({
  GastosService: {
    getUltimoGasto: vi.fn(),
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
  manejarEdicionNatural,
  manejarEliminacionNatural,
  normalizarCampos,
} from './acciones-nl.js';
import { GastosService } from '../services/gastos.service.js';
import { MENSAJE_ERROR_ACCION } from '../views/acciones.js';

const getUltimoGastoMock = vi.mocked(GastosService.getUltimoGasto);
const getGastoByIdMock = vi.mocked(GastosService.getGastoById);
const updateGastoMock = vi.mocked(GastosService.updateGasto);

const GASTO = {
  id: 77,
  monto: '4500',
  descripcion: 'Netflix',
  fecha: '2026-11-10T12:00:00.000Z',
  categoria: { nombre: 'Ocio y Entretenimiento' },
};

type Ctx = Parameters<typeof manejarEliminacionNatural>[0];

function crearCtx(): Ctx {
  return {
    from: { id: 1508127568 },
    session: {},
    reply: vi.fn(),
  } as unknown as Ctx;
}

function gastoIA(over: Record<string, unknown> = {}) {
  return {
    intent: 'DELETE_EXPENSE',
    monto: null,
    comercio: 'Netflix',
    categoria: null,
    descripcion: null,
    fecha: null,
    rango: null,
    recurringHint: null,
    searchHint: 'ultimo',
    campos: null,
    ...over,
  } as Parameters<typeof manejarEliminacionNatural>[2];
}

describe('normalizarCampos', () => {
  it('acepta monto numérico', () => {
    expect(normalizarCampos({ monto: 8000 })).toEqual({ monto: 8000 });
  });

  it('parsea monto en formato argentino', () => {
    expect(normalizarCampos({ monto: '$2.500,50' })).toEqual({ monto: 2500.5 });
  });

  it('descarta valores inválidos', () => {
    expect(normalizarCampos({ monto: -5, comercio: 'a', fecha: 'ayer' })).toBeNull();
  });

  it('devuelve null sin campos', () => {
    expect(normalizarCampos(null)).toBeNull();
    expect(normalizarCampos({})).toBeNull();
  });
});

describe('manejarEliminacionNatural', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUltimoGastoMock.mockResolvedValue(GASTO);
  });

  it('busca por comercio y pide confirmación con teclado', async () => {
    const ctx = crearCtx();

    await manejarEliminacionNatural(ctx, '1508127568', gastoIA());

    expect(getUltimoGastoMock).toHaveBeenCalledWith('1508127568', {
      comercio: 'Netflix',
    });
    expect(ctx.session.pendingDelete).toMatchObject({
      gastoId: 77,
      monto: 4500,
      categoria: 'Ocio y Entretenimiento',
    });
    const [texto, opciones] = vi.mocked(ctx.reply).mock.calls[0]!;
    expect(String(texto)).toContain('#77');
    expect(opciones).toMatchObject({
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: expect.any(Array) },
    });
  });

  it('avisa cuando no encuentra coincidencias', async () => {
    getUltimoGastoMock.mockResolvedValue(null as never);
    const ctx = crearCtx();

    await manejarEliminacionNatural(ctx, '1508127568', gastoIA());

    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'No encontré ese gasto',
    );
    expect(ctx.session.pendingDelete).toBeUndefined();
  });

  it('no actúa si el gasto devuelto no coincide con el comercio', async () => {
    // La API devuelve el último gasto aunque el filtro no coincida.
    getUltimoGastoMock.mockResolvedValue(GASTO);
    const ctx = crearCtx();

    await manejarEliminacionNatural(
      ctx,
      '1508127568',
      gastoIA({ comercio: 'LocalInexistente' }),
    );

    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'No encontré ese gasto',
    );
    expect(ctx.session.pendingDelete).toBeUndefined();
  });

  it('responde un error amable si falla el servicio', async () => {
    getUltimoGastoMock.mockRejectedValue(new Error('boom'));
    const ctx = crearCtx();

    await manejarEliminacionNatural(ctx, '1508127568', gastoIA());

    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toBe(MENSAJE_ERROR_ACCION);
  });
});

describe('manejarEdicionNatural', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUltimoGastoMock.mockResolvedValue(GASTO);
  });

  it('aplica los campos extraídos por la IA', async () => {
    updateGastoMock.mockResolvedValue({ ...GASTO, monto: '8000' } as never);
    const ctx = crearCtx();

    await manejarEdicionNatural(
      ctx,
      '1508127568',
      gastoIA({ intent: 'EDIT_EXPENSE', campos: { monto: 8000 } }),
    );

    expect(updateGastoMock).toHaveBeenCalledWith(77, '1508127568', { monto: 8000 });
    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'Gasto #77 actualizado',
    );
  });

  it('abre el selector de campos si la IA no extrajo cambios', async () => {
    const ctx = crearCtx();

    await manejarEdicionNatural(
      ctx,
      '1508127568',
      gastoIA({ intent: 'EDIT_EXPENSE', campos: null }),
    );

    expect(ctx.session.pendingEdit).toMatchObject({ gastoId: 77 });
    const [texto, opciones] = vi.mocked(ctx.reply).mock.calls[0]!;
    expect(String(texto)).toContain('Modificar gasto #77');
    expect(opciones).toMatchObject({
      reply_markup: { inline_keyboard: expect.any(Array) },
    });
  });

  it('avisa cuando no encuentra coincidencias', async () => {
    getUltimoGastoMock.mockResolvedValue(null as never);
    const ctx = crearCtx();

    await manejarEdicionNatural(
      ctx,
      '1508127568',
      gastoIA({ intent: 'EDIT_EXPENSE' }),
    );

    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'No encontré ese gasto',
    );
  });
});
