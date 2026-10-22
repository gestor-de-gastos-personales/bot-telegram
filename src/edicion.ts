import type { GastoAnalizado } from './services/ia.service.js';

/** Campos del gasto que el usuario puede corregir antes de confirmar. */
export type CampoEditable = 'monto' | 'descripcion' | 'categoria';

export interface ResultadoEdicion {
  gasto: GastoAnalizado;
  error?: string;
}

export const MENSAJE_MONTO_INVALIDO =
  '⚠️ El monto debe ser un número mayor a cero. Probá de nuevo:';

export const MENSAJE_TEXTO_VACIO =
  '⚠️ El valor no puede estar vacío. Probá de nuevo:';

/** Normaliza formatos como "$1.500,50" o "1500.50". */
function parsearMonto(valor: string): number | null {
  let limpio = valor.replace(/[$\s]/g, '');

  if (limpio.includes(',') && limpio.includes('.')) {
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    limpio = limpio.replace(/\./g, '');
  } else {
    limpio = limpio.replace(',', '.');
  }

  const monto = Number(limpio);
  return Number.isFinite(monto) && monto > 0 ? monto : null;
}

/**
 * Aplica una corrección al gasto pendiente sin mutar el objeto original.
 * Devuelve un error legible cuando el valor ingresado no es válido.
 */
export function aplicarEdicion(
  gasto: GastoAnalizado,
  campo: CampoEditable,
  valor: string,
): ResultadoEdicion {
  if (campo === 'monto') {
    const monto = parsearMonto(valor);
    return monto === null
      ? { gasto, error: MENSAJE_MONTO_INVALIDO }
      : { gasto: { ...gasto, monto } };
  }

  const texto = valor.trim();

  if (!texto) {
    return { gasto, error: MENSAJE_TEXTO_VACIO };
  }

  return campo === 'descripcion'
    ? { gasto: { ...gasto, descripcion: texto } }
    : { gasto: { ...gasto, categoria: texto } };
}
