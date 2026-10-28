import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IaService } from './ia.service.js';

const fetchMock = vi.fn();

function respuestaJson(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

function respuestaError(status: number, body = ''): Response {
  return {
    ok: false,
    status,
    text: async () => body,
  } as Response;
}

describe('IaService', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.SERVICIO_IA_URL = 'http://ia.test/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SERVICIO_IA_URL;
  });

  it('analiza un texto y normaliza la respuesta', async () => {
    fetchMock.mockResolvedValue(
      respuestaJson({
        intent: 'GASTO',
        monto: '1500',
        comercio: 'Coto',
        categoria: null,
        descripcion: undefined,
      }),
    );

    const gasto = await IaService.analizarTexto('Gasté 1500 en el Coto');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://ia.test/analizar',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ texto: 'Gasté 1500 en el Coto' }),
      }),
    );
    expect(gasto).toEqual({
      intent: 'GASTO',
      monto: 1500,
      comercio: 'Coto',
      categoria: null,
      descripcion: null,
      fecha: null,
      rango: null,
    });
  });

  it('completa los campos faltantes con valores seguros', async () => {
    fetchMock.mockResolvedValue(respuestaJson({}));

    const gasto = await IaService.analizarTexto('hola');

    expect(gasto).toEqual({
      intent: 'UNKNOWN',
      monto: null,
      comercio: null,
      categoria: null,
      descripcion: null,
      fecha: null,
      rango: null,
    });
  });

  it('explica el error cuando falta la ruta de servicio-ia', async () => {
    fetchMock.mockResolvedValue(respuestaError(404));

    await expect(IaService.analizarTexto('hola')).rejects.toThrow(
      'servicio-ia no tiene la ruta esperada (404). ¿Está corriendo en http://ia.test?',
    );
  });

  it('incluye el detalle de otros errores HTTP', async () => {
    fetchMock.mockResolvedValue(respuestaError(502, 'Bad Gateway'));

    await expect(IaService.analizarTexto('hola')).rejects.toThrow(
      'servicio-ia respondió 502: Bad Gateway',
    );
  });

  it('envía la imagen como multipart al analizador de comprobantes', async () => {
    fetchMock.mockResolvedValue(
      respuestaJson({
        intent: 'GASTO',
        monto: 900,
        comercio: 'Farmacia',
        categoria: 'Salud',
        descripcion: 'Remedios',
      }),
    );

    const gasto = await IaService.analizarImagen(
      Buffer.from('imagen-de-prueba'),
      'ticket.jpg',
    );

    const opciones = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://ia.test/analizar-imagen');
    expect(opciones.method).toBe('POST');
    expect(opciones.body).toBeInstanceOf(FormData);
    expect(gasto).toMatchObject({ monto: 900, comercio: 'Farmacia' });
  });
});
