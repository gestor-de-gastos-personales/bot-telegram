import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GastosService } from './gastos.service.js';

const fetchMock = vi.fn();

function respuestaJson(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

function respuestaError(status: number, body: string): Response {
  return {
    ok: false,
    status,
    text: async () => body,
  } as Response;
}

describe('GastosService', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.API_GASTOS_URL = 'http://api.test';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.API_GASTOS_URL;
  });

  it('envía el gasto al endpoint libre del bot', async () => {
    fetchMock.mockResolvedValue(respuestaJson({ id: 10 }));

    const resultado = await GastosService.createExpense({
      monto: 1500,
      categoria: 'Alimentación',
      comercio: 'Coto',
      descripcion: 'Compra semanal',
      telegramId: '55',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/gastos/bot',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          monto: 1500,
          categoria: 'Alimentación',
          comercio: 'Coto',
          descripcion: 'Compra semanal',
          telegramId: '55',
        }),
      }),
    );
    expect(resultado).toEqual({ id: 10 });
  });

  it('usa el comercio como descripción cuando falta', async () => {
    fetchMock.mockResolvedValue(respuestaJson({ id: 11 }));

    await GastosService.createExpense({
      monto: 200,
      categoria: null,
      comercio: 'Kiosco',
      descripcion: null,
      telegramId: '55',
    });

    const body = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(body.descripcion).toBe('Kiosco');
  });

  it('propaga el error cuando api-gastos rechaza el gasto', async () => {
    fetchMock.mockResolvedValue(respuestaError(400, 'categoría inexistente'));

    await expect(
      GastosService.createExpense({
        monto: 100,
        categoria: 'Inexistente',
        comercio: null,
        descripcion: null,
        telegramId: '55',
      }),
    ).rejects.toThrow('api-gastos respondió 400: categoría inexistente');
  });

  it('codifica el telegramId al pedir el resumen', async () => {
    fetchMock.mockResolvedValue(
      respuestaJson({ totalGeneral: 1000, porCategoria: [] }),
    );

    const resultado = await GastosService.getSummary('55 66');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/gastos/resumen/bot?telegramId=55%2066',
      {},
    );
    expect(resultado).toMatchObject({ totalGeneral: 1000 });
  });
});
