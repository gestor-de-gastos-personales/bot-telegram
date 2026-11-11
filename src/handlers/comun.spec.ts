import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { responderErrorAccion, responderOEditar } from './comun.js';
import { logger } from '../utils/logger.js';

type Ctx = Parameters<typeof responderOEditar>[0];

function crearCtx(over: Record<string, unknown> = {}): Ctx {
  return {
    from: { id: 1508127568 },
    session: {},
    reply: vi.fn(),
    editMessageText: vi.fn(),
    ...over,
  } as unknown as Ctx;
}

const TECLADO = [[{ text: 'Cancelar', callback_data: 'editno' }]];

describe('responderOEditar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responde con un mensaje nuevo cuando no viene de un callback', async () => {
    const ctx = crearCtx();

    await responderOEditar(ctx, 'Hola', TECLADO);

    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Hola', {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: TECLADO },
    });
  });

  it('edita el mensaje del callback', async () => {
    const ctx = crearCtx({ callbackQuery: { message: {} } });

    await responderOEditar(ctx, 'Hola');

    expect(ctx.editMessageText).toHaveBeenCalledWith('Hola', {
      parse_mode: 'HTML',
    });
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('ignora el doble clic cuando Telegram dice que no cambió nada', async () => {
    const ctx = crearCtx({ callbackQuery: { message: {} } });
    vi.mocked(ctx.editMessageText).mockRejectedValue(
      new Error('Bad Request: message is not modified'),
    );

    await responderOEditar(ctx, 'Hola');

    expect(ctx.reply).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('envía un mensaje nuevo si el mensaje viejo no se puede editar', async () => {
    const ctx = crearCtx({ callbackQuery: { message: {} } });
    vi.mocked(ctx.editMessageText).mockRejectedValue(
      new Error('Bad Request: message to edit not found'),
    );

    await responderOEditar(ctx, 'Hola');

    expect(ctx.reply).toHaveBeenCalledWith('Hola', { parse_mode: 'HTML' });
    expect(logger.warn).toHaveBeenCalled();
  });
});

describe('responderErrorAccion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra el detalle y avisa al usuario sin exponerlo', async () => {
    const ctx = crearCtx();

    await responderErrorAccion(ctx, new Error('fallo interno'), 'Contexto de prueba');

    expect(logger.error).toHaveBeenCalledWith(
      { detalle: 'fallo interno' },
      'Contexto de prueba',
    );
    expect(String(vi.mocked(ctx.reply).mock.calls[0]![0])).toContain(
      'No pude completar la operación',
    );
  });
});
