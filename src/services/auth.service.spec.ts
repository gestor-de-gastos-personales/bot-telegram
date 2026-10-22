import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

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

describe('AuthService', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.API_GASTOS_URL = 'http://api.test/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.API_GASTOS_URL;
  });

  it('vincula la cuenta web enviando las credenciales', async () => {
    fetchMock.mockResolvedValue(
      respuestaJson({
        id: 1,
        email: 'ana@mail.com',
        nombre: 'Ana',
        telegramId: '55',
      }),
    );

    const resultado = await AuthService.vincularTelegram({
      email: 'ana@mail.com',
      password: 'secreto123',
      telegramId: '55',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/auth/vincular-telegram',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'ana@mail.com',
          password: 'secreto123',
          telegramId: '55',
        }),
      }),
    );
    expect(resultado).toMatchObject({ id: 1, telegramId: '55' });
  });

  it('propaga el mensaje de error de api-gastos', async () => {
    fetchMock.mockResolvedValue(
      respuestaError(401, JSON.stringify({ message: 'Credenciales inválidas' })),
    );

    await expect(
      AuthService.vincularTelegram({
        email: 'ana@mail.com',
        password: 'incorrecta',
        telegramId: '55',
      }),
    ).rejects.toThrow('api-gastos respondió 401: Credenciales inválidas');
  });

  it('une los mensajes de validación que devuelve NestJS', async () => {
    fetchMock.mockResolvedValue(
      respuestaError(
        400,
        JSON.stringify({ message: ['email inválido', 'password requerida'] }),
      ),
    );

    await expect(
      AuthService.registrarTelegram({
        email: 'mal',
        password: '',
        telegramId: '55',
      }),
    ).rejects.toThrow('email inválido, password requerida');
  });

  it('registra una cuenta nueva con el nombre del usuario', async () => {
    fetchMock.mockResolvedValue(
      respuestaJson({ id: 2, email: 'nueva@mail.com', telegramId: '77' }),
    );

    await AuthService.registrarTelegram({
      email: 'nueva@mail.com',
      password: 'secreto123',
      telegramId: '77',
      nombre: 'Nueva',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/auth/register-telegram',
      expect.objectContaining({
        body: JSON.stringify({
          email: 'nueva@mail.com',
          password: 'secreto123',
          telegramId: '77',
          nombre: 'Nueva',
        }),
      }),
    );
  });

  it('conserva el detalle crudo cuando el error no es JSON', async () => {
    fetchMock.mockResolvedValue(respuestaError(500, 'Internal Server Error'));

    await expect(
      AuthService.registrarTelegram({
        email: 'nueva@mail.com',
        password: 'secreto123',
        telegramId: '77',
      }),
    ).rejects.toThrow('api-gastos respondió 500: Internal Server Error');
  });
});
