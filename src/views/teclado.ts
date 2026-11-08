/**
 * Tipos compartidos de los teclados inline del bot.
 */
export interface BotonInline {
  text: string;
  callback_data: string;
}

/**
 * Etiquetas estándar de la paginación.
 *
 * Se usan las mismas en todas las listas paginadas (`/historial`, `/eliminar`
 * y `/modificar`) para que el usuario no tenga que aprender dos formatos.
 */
export const ETIQUETA_ANTERIOR = '« Anterior';
export const ETIQUETA_SIGUIENTE = 'Siguiente »';

/** Texto del botón informativo de página (no navega, solo confirma el toque). */
export function etiquetaPagina(pagina: number, totalPages: number): string {
  return `Página ${pagina}/${totalPages}`;
}

/**
 * Construye la fila de paginación estándar.
 *
 * `anterior` y `siguiente` son opcionales: solo se dibujan si existen, así
 * que en la primera página no aparece "Anterior" y en la última no aparece
 * "Siguiente".
 */
export function construirFilaPaginacion(
  pagina: number,
  totalPages: number,
  callbacks: { anterior?: string; siguiente?: string; noop: string },
): BotonInline[] {
  const fila: BotonInline[] = [];

  if (pagina > 1 && callbacks.anterior) {
    fila.push({ text: ETIQUETA_ANTERIOR, callback_data: callbacks.anterior });
  }

  fila.push({ text: etiquetaPagina(pagina, totalPages), callback_data: callbacks.noop });

  if (pagina < totalPages && callbacks.siguiente) {
    fila.push({ text: ETIQUETA_SIGUIENTE, callback_data: callbacks.siguiente });
  }

  return fila;
}
