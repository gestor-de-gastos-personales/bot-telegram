/**
 * Escapa los caracteres reservados de HTML para que Telegram no rechace
 * el mensaje con un error de "can't parse entities".
 */
export function escapeHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
