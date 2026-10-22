import { baseUrl, postJson } from './http.js';
import type { OpcionesError } from './http.js';

export interface DatosVinculacion {
  email: string;
  password: string;
  telegramId: string;
  nombre?: string;
}

export interface UsuarioVinculado {
  id: number;
  email: string;
  nombre: string;
  telegramId: string | null;
}

const apiGastos = () =>
  baseUrl('API_GASTOS_URL', 'http://127.0.0.1:3000');

const ERROR_API: OpcionesError = {
  servicio: 'api-gastos',
  parsearJson: true,
};

export class AuthService {
  /**
   * Vincula una cuenta web existente con el telegramId del usuario.
   */
  static async vincularTelegram(
    datos: DatosVinculacion,
  ): Promise<UsuarioVinculado> {
    return postJson<UsuarioVinculado>(
      `${apiGastos()}/auth/vincular-telegram`,
      {
        email: datos.email,
        password: datos.password,
        telegramId: datos.telegramId,
      },
      ERROR_API,
    );
  }

  /**
   * Crea una cuenta nueva y la vincula con el telegramId en un solo paso.
   */
  static async registrarTelegram(
    datos: DatosVinculacion,
  ): Promise<UsuarioVinculado> {
    return postJson<UsuarioVinculado>(
      `${apiGastos()}/auth/register-telegram`,
      {
        email: datos.email,
        password: datos.password,
        telegramId: datos.telegramId,
        nombre: datos.nombre,
      },
      ERROR_API,
    );
  }
}
