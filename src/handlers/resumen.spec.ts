import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  manejarResumenComando,
  responderResumen,
  responderResumenPorTexto,
} from './resumen.js';

vi.mock('../services/gastos.service.js', () => ({
  GastosService: {
    getSummary: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { GastosService } from '../services/gastos.service.js';

const getSummaryMock = vi.mocked(GastosService.getSummary);

const RESUMEN = {
  periodo: {
    mes: null,
    anio: 2026,
    rango: null,
    fechaInicio: '2026-10-01T00:00:00.000Z',
    fechaFin: '2026-10-31T23:59:59.999Z',
  },
  totalGeneral: 2560319,
  porCategoria: [
    { categoriaId: 1, categoriaNombre: 'Alimentación', total: 2560319, porcentaje: 100 },
  ],
};

function crearCtx(match = '') {
  return {
    from: { id: 1508127568 },
    match,
    reply: vi.fn(),
  } as unknown as Parameters<typeof manejarResumenComando>[0];
}

function textoDe(ctx: ReturnType<typeof crearCtx>): string {
  const llamada = ctx.reply as unknown as { mock: { calls: unknown[][] } };
  return String(llamada.mock.calls[0]?.[0] ?? '');
}

describe('comando /resumen', () => {
  beforeEach(() => {
    getSummaryMock.mockReset();
    getSummaryMock.mockResolvedValue(RESUMEN);
  });

  it('sin fechas muestra el año actual', async () => {
    const ctx = crearCtx('');

    await manejarResumenComando(ctx);

    expect(getSummaryMock).toHaveBeenCalledWith('1508127568', { rango: 'YEAR' });
    expect(textoDe(ctx)).toContain('Resumen de');
  });

  it('acepta las palabras de período: hoy, semana, mes y año', async () => {
    const casos: Array<[string, string]> = [
      ['hoy', 'TODAY'],
      ['semana', 'WEEK'],
      ['mes', 'MONTH'],
      ['año', 'YEAR'],
      ['anio', 'YEAR'],
    ];

    for (const [argumento, rango] of casos) {
      const ctx = crearCtx(argumento);

      await manejarResumenComando(ctx);

      expect(getSummaryMock).toHaveBeenLastCalledWith('1508127568', { rango });
    }
  });

  it('con dos fechas pide el rango a la API', async () => {
    const ctx = crearCtx('011026 311026');

    await manejarResumenComando(ctx);

    expect(getSummaryMock).toHaveBeenCalledWith('1508127568', {
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
    expect(textoDe(ctx)).toContain('Resumen del 01/10/2026 al 31/10/2026');
  });

  it('con una sola fecha usa hoy como fecha final', async () => {
    const ctx = crearCtx('011026');

    await manejarResumenComando(ctx);

    const opciones = getSummaryMock.mock.calls[0]?.[1] as {
      desde: string;
      hasta: string;
    };
    expect(opciones.desde).toBe('2026-10-01');
    expect(opciones.hasta).toBe(new Date().toISOString().slice(0, 10));
  });

  it('explica el formato cuando no entiende las fechas', async () => {
    const ctx = crearCtx('el año pasado');

    await manejarResumenComando(ctx);

    expect(getSummaryMock).not.toHaveBeenCalled();
    expect(textoDe(ctx)).toContain('/resumen 011126 301126');
  });

  it('incluye la pista de formato en cada resumen', async () => {
    const ctx = crearCtx('');

    await manejarResumenComando(ctx);

    expect(textoDe(ctx)).toContain('DDMMAA');
  });

  it('avisa cuando corrigió las fechas invertidas', async () => {
    const ctx = crearCtx('311026 011026');

    await manejarResumenComando(ctx);

    expect(textoDe(ctx)).toContain('Ajusté el rango');
    expect(getSummaryMock).toHaveBeenCalledWith('1508127568', {
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
  });

  it('avisa cuando la API falla', async () => {
    getSummaryMock.mockRejectedValue(new Error('sin conexión'));
    const ctx = crearCtx('');

    await responderResumen(ctx, '1508127568', 'YEAR');

    expect(textoDe(ctx)).toContain('No pude calcular el resumen');
  });

  it('en texto libre interpreta un rango escrito cuando la IA no da rango', async () => {
    const ctx = crearCtx('');

    await responderResumenPorTexto(ctx, '1508127568', null, 'del 011026 al 311026');

    expect(getSummaryMock).toHaveBeenCalledWith('1508127568', {
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
  });

  it('en texto libre respeta el rango que detectó la IA', async () => {
    const ctx = crearCtx('');

    await responderResumenPorTexto(ctx, '1508127568', 'TODAY', '011026 311026');

    expect(getSummaryMock).toHaveBeenCalledWith('1508127568', { rango: 'TODAY' });
  });
});
