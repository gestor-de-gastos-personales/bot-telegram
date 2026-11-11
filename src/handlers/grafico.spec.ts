import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/gastos.service.js', () => ({
  GastosService: {
    getSummary: vi.fn(),
  },
}));

import { manejarGraficoComando } from './grafico.js';
import { GastosService } from '../services/gastos.service.js';

const getSummaryMock = vi.mocked(GastosService.getSummary);

const resumen = {
  periodo: {
    rango: 'MONTH' as const,
    mes: 10,
    anio: 2026,
    fechaInicio: '2026-10-01',
    fechaFin: '2026-10-31',
  },
  totalGeneral: 1500,
  porCategoria: [
    { categoriaId: 1, categoriaNombre: 'Alimentación', total: 1000, porcentaje: 66.6 },
    { categoriaId: 2, categoriaNombre: 'Transporte', total: 500, porcentaje: 33.4 },
  ],
};

function crearCtx(match = '') {
  return {
    from: { id: 1508127568 },
    match,
    reply: vi.fn(),
    replyWithPhoto: vi.fn(),
  } as unknown as Parameters<typeof manejarGraficoComando>[0];
}

describe('manejarGraficoComando', () => {
  beforeEach(() => {
    getSummaryMock.mockReset();
  });

  it('envía la imagen del gráfico con caption del período y total', async () => {
    getSummaryMock.mockResolvedValue(resumen);
    const ctx = crearCtx('');

    await manejarGraficoComando(ctx);

    expect(getSummaryMock).toHaveBeenCalledWith('1508127568', { rango: 'MONTH' });
    expect(ctx.replyWithPhoto).toHaveBeenCalledTimes(1);
    const [url, opciones] = vi.mocked(ctx.replyWithPhoto).mock.calls[0]!;
    expect(String(url)).toContain('quickchart.io/chart');
    expect(String(url)).toContain('v=4');
    expect((opciones as { caption: string }).caption).toContain('$1.500');
    expect((opciones as { caption: string }).caption).toContain('octubre');
  });

  it('interpreta los rangos hoy, semana, mes y año', async () => {
    getSummaryMock.mockResolvedValue(resumen);
    const casos: Array<[string, string]> = [
      ['hoy', 'TODAY'],
      ['semana', 'WEEK'],
      ['mes', 'MONTH'],
      ['año', 'YEAR'],
      ['anio', 'YEAR'],
    ];

    for (const [arg, rango] of casos) {
      const ctx = crearCtx(arg);
      await manejarGraficoComando(ctx);
      expect(getSummaryMock).toHaveBeenLastCalledWith('1508127568', { rango });
    }
  });

  it('acepta una fecha como /grafico 010126', async () => {
    getSummaryMock.mockResolvedValue({
      ...resumen,
      periodo: {
        rango: null,
        mes: null,
        anio: 2026,
        fechaInicio: '2026-01-01',
        fechaFin: new Date().toISOString().slice(0, 10),
      },
    });
    const ctx = crearCtx('010126');

    await manejarGraficoComando(ctx);

    expect(getSummaryMock).toHaveBeenCalledWith('1508127568', {
      desde: '2026-01-01',
      hasta: new Date().toISOString().slice(0, 10),
    });
    const [, opciones] = vi.mocked(ctx.replyWithPhoto).mock.calls[0]!;
    expect((opciones as { caption: string }).caption).toContain('01/01/2026');
  });

  it('avisa cuando no entiende el período', async () => {
    const ctx = crearCtx('el año pasado');

    await manejarGraficoComando(ctx);

    expect(getSummaryMock).not.toHaveBeenCalled();
    expect(ctx.replyWithPhoto).not.toHaveBeenCalled();
    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain('/grafico');
  });

  it('sin datos responde un mensaje claro sin imagen', async () => {
    getSummaryMock.mockResolvedValue({
      ...resumen,
      porCategoria: [],
    });
    const ctx = crearCtx('');

    await manejarGraficoComando(ctx);

    expect(ctx.replyWithPhoto).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain('No registré gastos');
  });

  it('si la API falla avisa sin crashear', async () => {
    getSummaryMock.mockRejectedValue(new Error('boom'));
    const ctx = crearCtx('');

    await manejarGraficoComando(ctx);

    expect(ctx.replyWithPhoto).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      'No pude generar el gráfico. Intentá con /resumen para ver los datos.',
    );
  });
});
