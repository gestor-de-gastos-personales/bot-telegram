import { baseUrl, pedirJson, postJson } from './http.js';
import type { OpcionesError } from './http.js';

export interface GastoPayload {
  monto: number | null;
  categoria: string | null;
  comercio: string | null;
  descripcion: string | null;
  fecha?: string;
  telegramId: string;
}

/** Respuesta de GET /gastos/resumen/bot. */
export interface ResumenGastos {
  periodo: {
    mes: number | null;
    anio: number;
    fechaInicio: string;
    fechaFin: string;
  };
  totalGeneral: number;
  porCategoria: Array<{
    categoriaId: number;
    categoriaNombre: string;
    total: number;
    porcentaje: number;
  }>;
}

const apiGastos = () =>
  baseUrl('API_GASTOS_URL', 'http://127.0.0.1:3000');

const ERROR_API: OpcionesError = { servicio: 'api-gastos' };

export class GastosService {
  /**
   * Persiste un gasto del bot (endpoint libre POST /gastos/bot).
   */
  static async createExpense(payload: GastoPayload) {
    return postJson<unknown>(
      `${apiGastos()}/gastos/bot`,
      {
        monto: payload.monto,
        categoria: payload.categoria,
        comercio: payload.comercio,
        descripcion: payload.descripcion ?? payload.comercio ?? '',
        fecha: payload.fecha,
        telegramId: payload.telegramId,
      },
      ERROR_API,
    );
  }

  /**
   * Obtiene el resumen de gastos del usuario de Telegram.
   */
  static async getSummary(telegramId: string): Promise<ResumenGastos> {
    return pedirJson<ResumenGastos>(
      `${apiGastos()}/gastos/resumen/bot?telegramId=${encodeURIComponent(telegramId)}`,
      {},
      ERROR_API,
    );
  }
}
