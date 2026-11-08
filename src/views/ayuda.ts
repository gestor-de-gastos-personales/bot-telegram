import { construirTecladoAyuda } from './comandos.js';

/**
 * Pantalla de ayuda con los comandos disponibles del bot.
 */
export const MENSAJE_AYUDA = [
  '🤖 <b>Mangos</b> — tu asistente de gastos',
  '',
  '<b>💬 Registrar un gasto</b>',
  '• <i>"Gasté 1500 en el Coto"</i>',
  '• <i>"Pagué 800 de nafta"</i>',
  '• 📷 Mandame una foto del ticket y lo leo yo',
  '',
  '<b>🔍 Consultar mis gastos</b>',
  '• <code>/resumen</code> — total del período',
  '• <code>/resumen hoy|semana|mes|año</code> — un período puntual',
  '• <code>/resumen 011126 301126</code> — rango de fechas',
  '• <code>/historial</code> — todos tus gastos, paginados',
  '• <code>/grafico hoy|semana|mes|año</code> — gráfico por categoría',
  '',
  '<b>✏️ Gestionar cada gasto</b>',
  '• <code>/eliminar</code> — elegís el gasto y confirmás',
  '• <code>/modificar</code> — elegís el gasto y el campo a cambiar',
  '',
  '<b>⚙️ Otros</b>',
  '• <code>/categoria Gimnasio</code> — crear una categoría',
  '• <code>/start</code> — iniciar sesión o crear tu cuenta',
  '',
  '───────────────',
  '💡 <i>En /eliminar, /modificar e /historial usá las flechas para ver más gastos.</i>',
].join('\n');

/** Teclado con los accesos rápidos de la pantalla de ayuda. */
export function construirTecladoAyudaRapido() {
  return construirTecladoAyuda();
}
