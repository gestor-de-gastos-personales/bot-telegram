import { baseUrl, pedirJson, postJson } from './http.js';
import type { OpcionesError } from './http.js';

/**
 * Estructura normalizada que devuelve servicio-ia
 * (POST /analizar y POST /analizar-imagen).
 */
export interface GastoAnalizado {
  intent: string;
  monto: number | null;
  comercio: string | null;
  categoria: string | null;
  descripcion: string | null;
}

const servicioIa = () =>
  baseUrl('SERVICIO_IA_URL', 'http://127.0.0.1:3002');

function errorIa(): OpcionesError {
  return {
    servicio: 'servicio-ia',
    mensaje404: `servicio-ia no tiene la ruta esperada (404). ¿Está corriendo en ${servicioIa()}?`,
  };
}

/**
 * Normaliza la respuesta de servicio-ia para que el bot siempre trabaje
 * con la misma forma de objeto.
 */
function normalizarGasto(payload: unknown): GastoAnalizado {
  const data = (payload ?? {}) as Record<string, unknown>;
  const monto = data.monto;

  return {
    intent: typeof data.intent === 'string' ? data.intent : 'UNKNOWN',
    monto: monto === null || monto === undefined ? null : Number(monto),
    comercio: typeof data.comercio === 'string' ? data.comercio : null,
    categoria: typeof data.categoria === 'string' ? data.categoria : null,
    descripcion: typeof data.descripcion === 'string' ? data.descripcion : null,
  };
}

export class IaService {
  /**
   * Analiza un mensaje de texto plano ("Gasté 1500 en el Coto").
   */
  static async analizarTexto(texto: string): Promise<GastoAnalizado> {
    const data = await postJson<unknown>(
      `${servicioIa()}/analizar`,
      { texto },
      errorIa(),
    );

    return normalizarGasto(data);
  }

  /**
   * Analiza un comprobante/foto y devuelve el gasto extraído por visión OCR.
   */
  static async analizarImagen(
    imageBuffer: Buffer,
    filename: string = 'comprobante.jpg',
  ): Promise<GastoAnalizado> {
    const formData = new FormData();
    // Se copia a un Uint8Array propio para satisfying los tipos de Blob en ESM.
    const blob = new Blob([new Uint8Array(imageBuffer)], {
      type: 'image/jpeg',
    });
    formData.append('file', blob, filename);

    const data = await pedirJson<unknown>(
      `${servicioIa()}/analizar-imagen`,
      {
        method: 'POST',
        body: formData,
      },
      errorIa(),
    );

    return normalizarGasto(data);
  }
}
