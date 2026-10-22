import 'dotenv/config';

/**
 * Opciones para traducir una respuesta HTTP fallida a un Error del dominio.
 */
export interface OpcionesError {
  servicio: string;
  /** Interpreta el cuerpo del error como JSON de NestJS (message/array). */
  parsearJson?: boolean;
  /** Mensaje específico cuando el servicio responde 404. */
  mensaje404?: string;
}

/**
 * Lee la URL base de un servicio en tiempo de ejecución (no al cargar el
 * módulo) para respetar el orden de carga de dotenv.
 */
export function baseUrl(variable: string, porDefecto: string): string {
  return (process.env[variable] || porDefecto).replace(/\/+$/, '');
}

/**
 * Convierte la respuesta de error de NestJS (array de mensajes o string) en un
 * mensaje legible para el usuario de Telegram.
 */
function formatearMensaje(payload: unknown): string {
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
export async function leerError(
  res: Response,
  opciones: OpcionesError,
): Promise<Error> {
  if (res.status === 404 && opciones.mensaje404) {
    return new Error(opciones.mensaje404);
  }

  const detalle = await res.text().catch(() => '');
  let mensaje = detalle;

  if (opciones.parsearJson) {
    try {
      mensaje = formatearMensaje(JSON.parse(detalle));
    } catch {
      // Se conserva el detalle crudo si no es JSON válido.
    }
  }

  return new Error(
    `${opciones.servicio} respondió ${res.status}${mensaje ? `: ${mensaje}` : ''}`,
  );
}

/**
 * Ejecuta una petición HTTP y devuelve el JSON tipado, traduciendo los errores
 * de red o de status a un Error con contexto del servicio.
 */
export async function pedirJson<T>(
  url: string,
  init: RequestInit,
  opciones: OpcionesError,
): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    throw await leerError(res, opciones);
  }

  return (await res.json()) as T;
}

/**
 * Atajo para peticiones POST con cuerpo JSON.
 */
export function postJson<T>(
  url: string,
  cuerpo: unknown,
  opciones: OpcionesError,
): Promise<T> {
  return pedirJson<T>(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    },
    opciones,
  );
}
