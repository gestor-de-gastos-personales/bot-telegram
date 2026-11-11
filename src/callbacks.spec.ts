/**
 * Verifica que el bot REGISTRA los callbacks de /eliminar, /modificar y
 * /historial, incluida la paginación.
 *
 * Regresión: los handlers de paginación existían pero ningún
 * `bot.callbackQuery` los conectaba, así que los botones "Siguiente" llegaban
 * al bot y se ignoraban sin hacer nada.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Bot } from 'grammy';

vi.mock('./services/gastos.service.js', () => ({
  GastosService: {
    getUltimos: vi.fn(),
    getGastoById: vi.fn(),
    deleteGasto: vi.fn(),
    updateGasto: vi.fn(),
    getSummary: vi.fn(),
  },
}));

vi.mock('./utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { registrarCallbacksDeAcciones } from './callbacks.js';
import { GastosService } from './services/gastos.service.js';
import type { BotContexto } from './index.js';

const getUltimosMock = vi.mocked(GastosService.getUltimos);

const GASTO = {
  id: 101,
  monto: '5000',
  descripcion: 'Gimnasio',
  fecha: '2026-11-06T16:04:19.305Z',
  categoria: { nombre: 'Salud y Bienestar' },
};

const CHAT = 1508127568;

/** Bot de prueba con la info ya cargada para no llamar a la API de Telegram. */
function crearBot() {
  const bot = new Bot<BotContexto>('123456:token-de-prueba', {
    botInfo: {
      id: 1,
      is_bot: true,
      first_name: 'Mangos',
      username: 'mangos_test',
      can_join_groups: false,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
      can_manage_bots: false,
      supports_join_request_queries: false,
    },
  });

  registrarCallbacksDeAcciones(bot);

  /** Llamadas a la API de Telegram interceptadas durante el test. */
  const llamadas: Array<{ metodo: string; payload: Record<string, unknown> }> = [];

  const transformer = async (
    prev: (
      method: string,
      payload: unknown,
      signal?: AbortSignal,
    ) => Promise<unknown>,
    method: string,
    payload: unknown,
    signal?: AbortSignal,
  ) => {
    const datos = payload as Record<string, unknown>;

    if (method === 'sendMessage' || method === 'editMessageText') {
      llamadas.push({ metodo: method, payload: datos });
      return { ok: true, result: { message_id: llamadas.length, date: 0 } };
    }

    if (method === 'answerCallbackQuery') {
      llamadas.push({ metodo: method, payload: datos });
      return { ok: true, result: true };
    }

    return prev(method, payload, signal);
  };

  bot.api.config.use(
    transformer as unknown as Parameters<typeof bot.api.config.use>[0],
  );

  let updateId = 1;

  async function pulsarBoton(data: string) {
    await bot.handleUpdate({
      update_id: ++updateId,
      callback_query: {
        id: String(++updateId),
        from: { id: CHAT, is_bot: false, first_name: 'Bruno' },
        chat_instance: 'inst',
        data,
        message: {
          message_id: ++updateId,
          date: Math.floor(Date.now() / 1000),
          chat: { id: CHAT, type: 'private', first_name: 'Bruno' },
          from: { id: 1, is_bot: true, first_name: 'Mangos' },
          text: 'lista',
        },
      },
    } as never);
  }

  return { bot, llamadas, pulsarBoton };
}

function datosDeTeclado(llamada: { payload: Record<string, unknown> }) {
  const markup = llamada.payload.reply_markup as
    | { inline_keyboard?: Array<Array<{ text: string; callback_data: string }>> }
    | undefined;
  return (markup?.inline_keyboard ?? []).flat().map((boton) => boton.callback_data);
}

describe('paginación de /eliminar', () => {
  beforeEach(() => {
    getUltimosMock.mockReset();
    getUltimosMock.mockImplementation(async (_telegramId, opciones) => {
      const page = opciones?.page ?? 1;
      const limit = opciones?.limit ?? 5;
      return {
        data: [GASTO],
        meta: { page, limit, total: 12, totalPages: 3 },
      };
    });
  });

  it('el callback pagina:eliminar:2 trae la página 2', async () => {
    const { llamadas, pulsarBoton } = crearBot();

    await pulsarBoton('pagina:eliminar:2');

    expect(getUltimosMock).toHaveBeenCalledWith('1508127568', {
      limit: 5,
      page: 2,
    });

    const edit = llamadas.find((c) => c.metodo === 'editMessageText');
    expect(edit).toBeDefined();
    expect(String(edit!.payload.text)).toContain('Página 2 de 3');
    expect(datosDeTeclado(edit!)).toContain('pagina:eliminar:1');
    expect(datosDeTeclado(edit!)).toContain('pagina:eliminar:3');
  });

  it('el callback pagina:eliminar:noop solo confirma el toque', async () => {
    const { llamadas, pulsarBoton } = crearBot();

    await pulsarBoton('pagina:eliminar:noop');

    expect(getUltimosMock).not.toHaveBeenCalled();
    expect(llamadas.some((c) => c.metodo === 'answerCallbackQuery')).toBe(true);
  });
});

describe('paginación de /modificar', () => {
  beforeEach(() => {
    getUltimosMock.mockReset();
    getUltimosMock.mockImplementation(async (_telegramId, opciones) => {
      const page = opciones?.page ?? 1;
      const limit = opciones?.limit ?? 5;
      return {
        data: [GASTO],
        meta: { page, limit, total: 12, totalPages: 3 },
      };
    });
  });

  it('el callback pagina:modificar:2 trae la página 2', async () => {
    const { llamadas, pulsarBoton } = crearBot();

    await pulsarBoton('pagina:modificar:2');

    expect(getUltimosMock).toHaveBeenCalledWith('1508127568', {
      limit: 5,
      page: 2,
    });

    const edit = llamadas.find((c) => c.metodo === 'editMessageText');
    expect(edit).toBeDefined();
    expect(String(edit!.payload.text)).toContain('Página 2 de 3');
    expect(datosDeTeclado(edit!)).toContain('pagina:modificar:1');
  });
});

describe('paginación de /historial', () => {
  beforeEach(() => {
    getUltimosMock.mockReset();
    getUltimosMock.mockImplementation(async (_telegramId, opciones) => {
      const page = opciones?.page ?? 1;
      const limit = opciones?.limit ?? 10;
      return {
        data: [GASTO],
        meta: { page, limit, total: 29, totalPages: 3 },
      };
    });
  });

  it('el callback hist:2 trae la página 2', async () => {
    const { llamadas, pulsarBoton } = crearBot();

    await pulsarBoton('hist:2');

    expect(getUltimosMock).toHaveBeenCalledWith('1508127568', {
      limit: 10,
      page: 2,
    });

    const edit = llamadas.find((c) => c.metodo === 'editMessageText');
    expect(edit).toBeDefined();
    expect(String(edit!.payload.text)).toContain('Página 2 de 3');
  });

  it('el callback hist:noop solo confirma el toque', async () => {
    const { llamadas, pulsarBoton } = crearBot();

    await pulsarBoton('hist:noop');

    expect(getUltimosMock).not.toHaveBeenCalled();
    expect(llamadas.some((c) => c.metodo === 'answerCallbackQuery')).toBe(true);
  });
});

describe('selección de gastos', () => {
  beforeEach(() => {
    getUltimosMock.mockReset();
  });

  it('el callback del:101 pide el detalle del gasto', async () => {
    const { llamadas, pulsarBoton } = crearBot();

    await pulsarBoton('del:101');

    expect(llamadas.some((c) => c.metodo === 'answerCallbackQuery')).toBe(true);
  });

  it('el callback edit:101 pide el detalle modificable', async () => {
    const { llamadas, pulsarBoton } = crearBot();

    await pulsarBoton('edit:101');

    expect(llamadas.some((c) => c.metodo === 'answerCallbackQuery')).toBe(true);
  });
});

describe('accesos rápidos (cmd:*)', () => {
  beforeEach(() => {
    getUltimosMock.mockReset();
    getUltimosMock.mockImplementation(async (_telegramId, opciones) => {
      const page = opciones?.page ?? 1;
      const limit = opciones?.limit ?? 10;
      return {
        data: [GASTO],
        meta: { page, limit, total: 29, totalPages: 3 },
      };
    });

    const getSummaryMock = vi.mocked(GastosService.getSummary);
    getSummaryMock.mockReset();
    getSummaryMock.mockResolvedValue({
      periodo: {
        mes: null,
        anio: 2026,
        rango: 'YEAR',
        fechaInicio: '',
        fechaFin: '',
      },
      totalGeneral: 5000,
      porCategoria: [
        {
          categoriaId: 1,
          categoriaNombre: 'Salud y Bienestar',
          total: 5000,
          porcentaje: 100,
        },
      ],
    });
  });

  it('cmd:resumen responde con el resumen del año', async () => {
    const { llamadas, pulsarBoton } = crearBot();

    await pulsarBoton('cmd:resumen');

    const envio = llamadas.find((c) => c.metodo === 'sendMessage');
    expect(envio).toBeDefined();
    expect(String(envio!.payload.text)).toContain('Total gastado');
    expect(String(envio!.payload.text)).toContain('$5.000');
  });

  it('cmd:historial responde un mensaje nuevo y no pisa la ayuda', async () => {
    const { llamadas, pulsarBoton } = crearBot();

    await pulsarBoton('cmd:historial');

    const envio = llamadas.find((c) => c.metodo === 'sendMessage');
    expect(envio).toBeDefined();
    expect(String(envio!.payload.text)).toContain('Historial de gastos');
    expect(llamadas.some((c) => c.metodo === 'editMessageText')).toBe(false);
    expect(datosDeTeclado(envio!)).toContain('edit:101');
    expect(datosDeTeclado(envio!)).toContain('del:101');
  });

  it('cmd:ayuda responde la ayuda con los accesos rápidos', async () => {
    const { llamadas, pulsarBoton } = crearBot();

    await pulsarBoton('cmd:ayuda');

    const envio = llamadas.find((c) => c.metodo === 'sendMessage');
    expect(envio).toBeDefined();
    expect(String(envio!.payload.text)).toContain('/historial');
    expect(datosDeTeclado(envio!)).toContain('cmd:resumen');
    expect(datosDeTeclado(envio!)).toContain('cmd:historial');
  });

  it('cmd:eliminar lista los gastos con sus botones', async () => {
    const { llamadas, pulsarBoton } = crearBot();

    await pulsarBoton('cmd:eliminar');

    const envio = llamadas.find((c) => c.metodo === 'sendMessage');
    expect(envio).toBeDefined();
    expect(String(envio!.payload.text)).toContain('¿Qué gasto querés eliminar?');
    expect(datosDeTeclado(envio!)).toContain('del:101');
  });
});
