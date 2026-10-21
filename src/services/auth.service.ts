import 'dotenv/config';

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

/**
 * Lee la URL base de api-gastos en tiempo de ejecución (no al cargar el módulo)
 * para respetar el orden de carga de dotenv.
 */
function getApiGastosUrl(): string {
  return (process.env.API_GASTOS_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
}

/**
 * Convierte la respuesta de error de NestJS (array de mensajes o string) en un
 * mensaje legible para el usuario de Telegram.
 */
function formatearMensajeError(payload: unknown): string {
  const data = (payload ?? {}) as Record<string, unknown>;

  if (Array.isArray(data.message)) {
    return data.message.join(', ');
  }

  if (typeof data.message === 'string') {
    return data.message;
  }

  return 'Error en la operación';
}

/**
 * Construye un error descriptivo con el status HTTP y el cuerpo de la respuesta.
 */
async function leerError(res: Response): Promise<Error> {
  const detalle = await res.text().catch(() => '');
  let mensaje = detalle;

  try {
    mensaje = formatearMensajeError(JSON.parse(detalle));
  } catch {
    // Se conserva el detalle crudo si no es JSON válido.
  }

  return new Error(
    `api-gastos respondió ${res.status}${mensaje ? `: ${mensaje}` : ''}`,
  );
}

export class AuthService {
  /**
   * Vincula una cuenta web existente con el telegramId del usuario.
   */
  static async vincularTelegram(datos: DatosVinculacion): Promise<UsuarioVinculado> {
    const res = await fetch(`${getApiGastosUrl()}/auth/vincular-telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: datos.email,
        password: datos.password,
        telegramId: datos.telegramId,
      }),
    });

    if (!res.ok) {
      throw await leerError(res);
    }

    return (await res.json()) as UsuarioVinculado;
  }

  /**
   * Crea una cuenta nueva y la vincula con el telegramId en un solo paso.
   */
  static async registrarTelegram(datos: DatosVinculacion): Promise<UsuarioVinculado> {
    const res = await fetch(`${getApiGastosUrl()}/auth/register-telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: datos.email,
        password: datos.password,
        telegramId: datos.telegramId,
        nombre: datos.nombre,
      }),
    });

    if (!res.ok) {
      throw await leerError(res);
    }

    return (await res.json()) as UsuarioVinculado;
  }
}
