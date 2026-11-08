import { InlineKeyboard } from 'grammy';
import { construirTecladoAccesos } from './comandos.js';

/**
 * Pantalla de bienvenida del bot: explica cómo usarlo y ofrece accesos
 * directos a las funciones más usadas.
 */
export function vistaBienvenida(): {
  texto: string;
  teclado: InlineKeyboard;
} {
  return {
    texto: [
      '👋 ¡Hola! Soy <b>Mangos</b> 🍊',
      '',
      'Te ayudo a llevar tus gastos al día, sin planillas.',
      '',
      '<b>📝 Para registrar un gasto</b>',
      'Escribime algo como <i>"Gasté 1500 en el Coto"</i> y lo guardo al toque.',
      'También podés mandarme una foto de un ticket y lo leo yo. 📷',
      '',
      '<b>🔍 Para ver tus gastos</b>',
      'Resúmenes, historial y gráficos con un solo toque.',
    ].join('\n'),
    teclado: new InlineKeyboard()
      .text('🔑 Iniciar Sesión', 'auth_login')
      .text('📝 Registrarme', 'auth_register')
      .row(...construirTecladoAccesos(['resumen', 'historial'])[0]!)
      .row(...construirTecladoAccesos(['eliminar', 'modificar'])[0]!),
  };
}
