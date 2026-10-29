import { baseUrl, pedirJson, postJson } from './http.js';
import type { OpcionesError } from './http.js';
import type { RangoResumen } from '../dominio/rango.js';

export interface GastoPayload {
  monto: number | null;
  categoria: string | null;
  comercio: string | null;
  descripcion: string | null;
  fecha?: string | null;
  telegramId: string;
}

export interface OpcionesResumenBot {
  rango?: RangoResumen;
  desde?: string;
  hasta?: string;
}

/** Respuesta de GET /gastos/resumen/bot. */
export interface ResumenGastos {
  periodo: {
    mes: number | null;
    anio: number;
    rango?: RangoResumen | null;
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

export interface CategoriaCreada {
  id: number;
  nombre: string;
}

export interface GastoEncontrado {
  id: number;
  monto: number;
  descripcion: string;
  fecha: string;
  categoria?: { nombre: string };
  usuario?: { telegramId?: string };
}

export interface GastoRecurrente {
  id: number;
  monto: number;
  comercio?: string;
  categoriaId: number;
  descripcion: string;
  frecuencia: string;
  diaSemana?: number | null;
  diaMes?: number | null;
  activo: boolean;
  proximaEjecucion: string;
}

const apiGastos = () =>
  baseUrl('API_GASTOS_URL', 'http://127.0.0.1:3000');

const ERROR_API: OpcionesError = { servicio: 'api-gastos' };

export class GastosService {
  /**
   * Persiste un gasto del bot (endpoint libre POST /gastos/bot).
   */
  static async createExpense(payload: GastoPayload) {
    const cuerpo = {
      monto: payload.monto,
      categoria: payload.categoria,
      comercio: payload.comercio,
      descripcion: payload.descripcion ?? payload.comercio ?? '',
      telegramId: payload.telegramId,
      ...(payload.fecha ? { fecha: payload.fecha } : {}),
    };

    return postJson<unknown>(
      `${apiGastos()}/gastos/bot`,
      cuerpo,
      ERROR_API,
    );
  }

  /**
   * Obtiene el resumen de gastos del usuario de Telegram.
   * Acepta un rango predefinido o fechas ISO explícitas.
   */
  static async getSummary(
    telegramId: string,
    opciones: OpcionesResumenBot = {},
  ): Promise<ResumenGastos> {
    const params = new URLSearchParams({ telegramId });

    if (opciones.rango) params.set('rango', opciones.rango);
    if (opciones.desde) params.set('desde', opciones.desde);
    if (opciones.hasta) params.set('hasta', opciones.hasta);

    return pedirJson<ResumenGastos>(
      `${apiGastos()}/gastos/resumen/bot?${params.toString()}`,
      {},
      ERROR_API,
    );
  }

  /** Crea una categoría nueva desde el bot (POST /categorias es público). */
  static async createCategory(nombre: string): Promise<CategoriaCreada> {
    return postJson<CategoriaCreada>(
      `${apiGastos()}/categorias`,
      { nombre },
      ERROR_API,
    );
  }

  static async getUltimoGasto(
    telegramId: string,
    filtros: { comercio?: string; categoria?: string; desde?: string } = {},
  ): Promise<GastoEncontrado> {
    const params = new URLSearchParams({ telegramId });
    if (filtros.comercio) params.set('comercio', filtros.comercio);
    if (filtros.categoria) params.set('categoria', filtros.categoria);
    if (filtros.desde) params.set('desde', filtros.desde);

    return pedirJson<GastoEncontrado>(
      `${apiGastos()}/gastos/ultimo?${params.toString()}`,
      {},
      ERROR_API,
    );
  }

  static async getGastoById(gastoId: number, telegramId: string): Promise<GastoEncontrado> {
    return pedirJson<GastoEncontrado>(
      `${apiGastos()}/gastos/${gastoId}?telegramId=${encodeURIComponent(telegramId)}`,
      {},
      ERROR_API,
    );
  }

  static async deleteGasto(gastoId: number, telegramId: string) {
    const response = await fetch(
      `${apiGastos()}/gastos/${gastoId}?telegramId=${encodeURIComponent(telegramId)}`,
      { method: 'DELETE' },
    );
    if (!response.ok) {
      throw new Error(`api-gastos respondió ${response.status}`);
    }
    try {
      return await response.json();
    } catch {
      return { ok: true };
    }
  }

  static async updateGasto(gastoId: number, telegramId: string, datos: Record<string, unknown>) {
    const response = await fetch(
      `${apiGastos()}/gastos/${gastoId}?telegramId=${encodeURIComponent(telegramId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      },
    );
    if (!response.ok) {
      throw new Error(`api-gastos respondió ${response.status}`);
    }
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  static async createRecurrente(datos: Record<string, unknown>) {
    return postJson<GastoRecurrente>(
      `${apiGastos()}/gastos/recurrentes`,
      datos,
      ERROR_API,
    );
  }

  static async getRecurrentesVencidas() {
    return pedirJson<GastoRecurrente[]>(
      `${apiGastos()}/gastos/recurrentes/vencidas`,
      {},
      ERROR_API,
    );
  }

  static async ejecutarRecurrente(reglaId?: number) {
    return postJson<unknown>(
      `${apiGastos()}/gastos/recurrentes/ejecutar`,
      reglaId ? { reglaId } : {},
      ERROR_API,
    );
  }
}
