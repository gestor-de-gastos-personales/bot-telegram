import { InlineKeyboard } from 'grammy';

/**
 * Pantalla de bienvenida del bot con los accesos a login y registro.
 */
export function vistaBienvenida(): {
  texto: string;
  teclado: InlineKeyboard;
} {
  return {
    texto:
      '👋 ¡Bienvenido a Mangos!\n\nPara comenzar a registrar tus gastos, identificáte o creá tu cuenta:',
    teclado: new InlineKeyboard()
      .text('🔑 Iniciar Sesión', 'auth_login')
      .text('📝 Registrarme', 'auth_register'),
  };
}
