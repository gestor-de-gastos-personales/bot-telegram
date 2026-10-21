import 'dotenv/config';

export interface GastoPayload {
  monto: number | null;
  categoria: string | null;
  comercio: string | null;
  descripcion: string | null;
  fecha?: string;
  telegramId: string;
}

/**
 * Lee la URL base de api-gastos en tiempo de ejecución (no al cargar el módulo)
 * para respetar el orden de carga de dotenv.
 */
function getApiGastosUrl(): string {
  return (process.env.API_GASTOS_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
}

/**
 * Construye un error descriptivo con el status HTTP y el cuerpo de la respuesta.
 */
async function leerError(res: Response): Promise<Error> {
  const detalle = await res.text().catch(() => '');
  return new Error(
    `api-gastos respondió ${res.status}${detalle ? `: ${detalle}` : ''}`,
  );
}

export class GastosService {
  /**
   * Persiste un gasto del bot (endpoint libre POST /gastos/bot).
   */
  static async createExpense(payload: GastoPayload) {
    const res = await fetch(`${getApiGastosUrl()}/gastos/bot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monto: payload.monto,
        categoria: payload.categoria,
        comercio: payload.comercio,
        descripcion: payload.descripcion ?? payload.comercio ?? '',
        fecha: payload.fecha,
        telegramId: payload.telegramId,
      }),
    });

    if (!res.ok) {
      throw await leerError(res);
    }

    return (await res.json()) as unknown;
  }

  /**
   * Obtiene el resumen de gastos del usuario de Telegram.
   */
  static async getSummary(telegramId: string) {
    const res = await fetch(
      `${getApiGastosUrl()}/gastos/resumen/bot?telegramId=${encodeURIComponent(telegramId)}`,
    );

    if (!res.ok) {
      throw await leerError(res);
    }

    return (await res.json()) as unknown;
  }
}
