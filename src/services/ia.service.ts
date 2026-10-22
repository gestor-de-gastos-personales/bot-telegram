import 'dotenv/config';

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

/**
 * Lee la URL base de servicio-ia en tiempo de ejecución (no al cargar el módulo)
 * para respetar el orden de carga de dotenv.
 */
function getServicioIaUrl(): string {
  return (process.env.SERVICIO_IA_URL || 'http://127.0.0.1:3002').replace(/\/+$/, '');
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

/**
 * Construye un error descriptivo con el status HTTP y el cuerpo de la respuesta,
 * para poder diagnosticar la falla sin tener que mirar los logs del bot.
 */
async function leerError(res: Response): Promise<Error> {
  const detalle = await res.text().catch(() => '');

  if (res.status === 404) {
    return new Error(
      `servicio-ia no tiene la ruta esperada (404). ¿Está corriendo en ${getServicioIaUrl()}?`,
    );
  }

  return new Error(
    `servicio-ia respondió ${res.status}${detalle ? `: ${detalle}` : ''}`,
  );
}

export class IaService {
  /**
   * Analiza un mensaje de texto plano ("Gasté 1500 en el Coto").
   */
  static async analizarTexto(texto: string): Promise<GastoAnalizado> {
    const res = await fetch(`${getServicioIaUrl()}/analizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    });

    if (!res.ok) {
      throw await leerError(res);
    }

    return normalizarGasto(await res.json());
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
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
    formData.append('file', blob, filename);

    const res = await fetch(`${getServicioIaUrl()}/analizar-imagen`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw await leerError(res);
    }

    return normalizarGasto(await res.json());
  }
}
