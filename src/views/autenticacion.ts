/**
 * Textos del flujo de autenticación (login y registro desde Telegram).
 */
export const MENSAJE_SESION_PERDIDA =
  '⚠️ No pude recuperar tus datos. Reintentá con /start';

export const MENSAJE_CUENTA_VINCULADA =
  '✅ ¡Cuenta vinculada exitosamente! Ya podés registrar tus gastos enviándome mensajes.';

export const MENSAJE_CUENTA_CREADA =
  '✅ ¡Cuenta creada y vinculada con éxito! Ya podés registrar tus gastos enviándome mensajes.';

export function mensajeErrorAutenticacion(detalle: string): string {
  return `❌ Error: ${detalle}. Reintentá con /start`;
}
