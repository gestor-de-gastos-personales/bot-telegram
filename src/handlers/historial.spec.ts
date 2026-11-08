import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  construirTecladoHistorial,
  construirTextoHistorial,
  formatearMonto,
  manejarCallbackHistorial,
  manejarHistorialComando,
  responderHistorial,
  type GastoHistorial,
  type MetaHistorial,
} from './historial.js';

vi.mock('../services/gastos.service.js', () => ({
  GastosService: {
    getUltimos: vi.fn(),
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
import { logger } from '../utils/logger.js';

const getUltimosMock = vi.mocked(GastosService.getUltimos);

function gasto(id: number, over: Partial<GastoHistorial> = {}): GastoHistorial {
  return {
    id,
    monto: 1000 + id,
    descripcion: `Gasto ${id}`,
    fecha: `2026-10-2${id % 10}`,
    categoria: { nombre: `Cat ${id}` },
    ...over,
  };
}

function meta(page: number, totalPages: number, total = totalPages * 10): MetaHistorial {
  return { total, page, limit: 10, totalPages };
}

function crearCtx(respuesta: 'reply' | 'edit' | 'both') {
  return {
    from: { id: 1508127568 },
    match: '',
    callbackQuery: respuesta === 'reply' ? undefined : { message: { message_id: 5 } },
    reply: vi.fn(),
    editMessageText: vi.fn(),
    answerCallbackQuery: vi.fn(),
  } as unknown as Parameters<typeof responderHistorial>[0];
}

function primeraLlamada(
  ctx: Parameters<typeof responderHistorial>[0],
  metodo: 'reply' | 'editMessageText',
): [texto: string, opciones?: Record<string, unknown>] {
  const llamadas = ctx[metodo] as ReturnType<typeof vi.fn>;
  return (llamadas.mock.calls[0] ?? []) as [texto: string, opciones?: Record<string, unknown>];
}


describe('formatearMonto', () => {
  it('usa separador de miles sin decimales innecesarios', () => {
    expect(formatearMonto(1500)).toBe('$1.500');
    expect(formatearMonto(1234567.5)).toBe('$1.234.567,5');
    expect(formatearMonto(0)).toBe('$0');
  });
});

describe('construirTextoHistorial', () => {
  it('muestra fecha, monto, categoría y descripción escapados', () => {
    const texto = construirTextoHistorial(
      [gasto(1, { descripcion: 'Coto <y> Shell', categoria: { nombre: 'Comida & Bebidas' } })],
      meta(1, 1),
    );

    expect(texto).toContain('21/10/2026');
    expect(texto).toContain('$1.001');
    expect(texto).toContain('Coto &lt;y&gt; Shell');
    expect(texto).toContain('Comida &amp; Bebidas');
    expect(texto).toContain('Página 1 de 1');
  });

  it('usa la categoría por defecto cuando falta', () => {
    const texto = construirTextoHistorial([gasto(1, { categoria: null })], meta(1, 1));
    expect(texto).toContain('Sin categoría');
  });

  it('muestra el encabezado y el pie de página', () => {
    const texto = construirTextoHistorial([gasto(1)], meta(2, 3, 30));
    expect(texto).toContain('<b>Historial de gastos</b>');
    expect(texto).toContain('Página 2 de 3');
    expect(texto).toContain('30 gastos en total');
  });
});

describe('construirTecladoHistorial', () => {
  it('en la primera página solo muestra Siguiente', () => {
    const teclado = construirTecladoHistorial(meta(1, 3));
    expect(teclado).toHaveLength(1);
    const fila = teclado[0]!;
    expect(fila.map((b) => b.callback_data)).toEqual(['hist:noop', 'hist:2']);
    expect(fila.map((b) => b.text)).toEqual(['Página 1/3', 'Siguiente »']);
  });

  it('en la última página solo muestra Anterior', () => {
    const teclado = construirTecladoHistorial(meta(3, 3));
    expect(teclado[0]!.map((b) => b.callback_data)).toEqual(['hist:2', 'hist:noop']);
  });

  it('en una página intermedia muestra ambos', () => {
    const teclado = construirTecladoHistorial(meta(2, 3));
    expect(teclado[0]!.map((b) => b.callback_data)).toEqual(['hist:1', 'hist:noop', 'hist:3']);
  });

  it('sin páginas (sin gastos) no devuelve botones', () => {
    expect(construirTecladoHistorial(meta(1, 0, 0))).toEqual([]);
    expect(construirTecladoHistorial(meta(1, 1, 5))).toEqual([]);
  });
});

describe('responderHistorial', () => {
  beforeEach(() => {
    getUltimosMock.mockReset();
  });

  it('pagina con 10 gastos por página', async () => {
    getUltimosMock.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => gasto(i + 1)),
      meta: meta(1, 3),
    });
    const ctx = crearCtx('reply');

    await responderHistorial(ctx, 1);

    expect(getUltimosMock).toHaveBeenCalledWith('1508127568', { limit: 10, page: 1 });
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [texto, opciones] = primeraLlamada(ctx, 'reply');
    expect(texto).toContain('Página 1 de 3');
    expect(opciones).toMatchObject({ parse_mode: 'HTML' });
    const teclado = (opciones as { reply_markup: { inline_keyboard: unknown[][] } }).reply_markup.inline_keyboard;
    // Una fila por gasto con sus acciones, más la fila de paginación.
    expect(teclado).toHaveLength(11);
    expect(teclado[0]?.[0]).toEqual({ text: '✏️ #1', callback_data: 'edit:1' });
    expect(teclado[0]?.[1]).toEqual({ text: '🗑️ #1', callback_data: 'del:1' });
  });

  it('sin gastos responde un mensaje claro sin botones', async () => {
    getUltimosMock.mockResolvedValue({ data: [], meta: meta(1, 0, 0) });
    const ctx = crearCtx('reply');

    await responderHistorial(ctx, 1);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [texto, opciones] = primeraLlamada(ctx, 'reply');
    expect(texto).toContain('Todavía no tenés gastos registrados');
    expect(opciones?.reply_markup).toBeUndefined();
  });

  it('en un callback edita el mensaje en lugar de responder uno nuevo', async () => {
    getUltimosMock.mockResolvedValue({
      data: [gasto(1)],
      meta: meta(2, 2),
    });
    const ctx = crearCtx('edit');

    await responderHistorial(ctx, 2);

    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    expect(ctx.reply).not.toHaveBeenCalled();
    expect(primeraLlamada(ctx, 'editMessageText')[0]).toContain('Página 2 de 2');
  });

  it('con editarMensaje false responde un mensaje nuevo (acceso rápido)', async () => {
    getUltimosMock.mockResolvedValue({
      data: [gasto(1)],
      meta: meta(1, 1),
    });
    const ctx = crearCtx('edit');

    await responderHistorial(ctx, 1, { editarMensaje: false });

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(primeraLlamada(ctx, 'reply')[0]).toContain('Historial de gastos');
  });

  it('si la API falla avisa sin crashear', async () => {
    getUltimosMock.mockRejectedValue(new Error('boom'));
    const ctx = crearCtx('reply');

    await responderHistorial(ctx, 1);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('No pude cargar tu historial'),
      { parse_mode: 'HTML' },
    );
  });
});

describe('manejarCallbackHistorial', () => {
  beforeEach(() => {
    getUltimosMock.mockReset();
  });

  it('avanza a la página pedida', async () => {
    getUltimosMock.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => gasto(i + 11)),
      meta: meta(2, 3),
    });
    const ctx = crearCtx('edit');

    await manejarCallbackHistorial(ctx, 2);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(getUltimosMock).toHaveBeenCalledWith('1508127568', { limit: 10, page: 2 });
  });

  it('tolera callbacks viejos sin crashear', async () => {
    getUltimosMock.mockResolvedValue({
      data: [gasto(1)],
      meta: meta(1, 1),
    });
    const ctx = crearCtx('edit');
    vi.mocked(ctx.editMessageText).mockRejectedValue(
      Object.assign(new Error('Bad Request: message is not modified'), { code: 400 }),
    );

    await manejarCallbackHistorial(ctx, 1);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('si la API falla avisa en el chat sin crashear', async () => {
    getUltimosMock.mockRejectedValue(new Error('boom'));
    const ctx = crearCtx('edit');

    await manejarCallbackHistorial(ctx, 1);

    expect(ctx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('No pude cargar tu historial'),
      { parse_mode: 'HTML' },
    );
  });
});

describe('manejarHistorialComando', () => {
  beforeEach(() => {
    getUltimosMock.mockReset();
  });

  it('sin argumentos muestra la página 1', async () => {
    getUltimosMock.mockResolvedValue({ data: [gasto(1)], meta: meta(1, 1) });
    const ctx = crearCtx('reply');
    (ctx as { match: string }).match = '';

    await manejarHistorialComando(ctx);

    expect(getUltimosMock).toHaveBeenCalledWith('1508127568', { limit: 10, page: 1 });
  });

  it('con argumento numérico muestra esa página', async () => {
    getUltimosMock.mockResolvedValue({ data: [gasto(1)], meta: meta(2, 3) });
    const ctx = crearCtx('reply');
    (ctx as { match: string }).match = ' 2';

    await manejarHistorialComando(ctx);

    expect(getUltimosMock).toHaveBeenCalledWith('1508127568', { limit: 10, page: 2 });
  });

  it('argumentos inválidos caen a la página 1', async () => {
    getUltimosMock.mockResolvedValue({ data: [gasto(1)], meta: meta(1, 1) });
    const ctx = crearCtx('reply');
    (ctx as { match: string }).match = ' abc';

    await manejarHistorialComando(ctx);

    expect(getUltimosMock).toHaveBeenCalledWith('1508127568', { limit: 10, page: 1 });
  });
});
