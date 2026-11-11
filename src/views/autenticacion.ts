/**
 * Textos del flujo de autenticación (login y registro desde Telegram).
 */
export const MENSAJE_SESION_PERDIDA =
  '⚠️ No pude recuperar tus datos. Reintentá con /start en un momento.';

export const MENSAJE_CUENTA_VINCULADA =
  '✅ ¡Cuenta vinculada! Ya podés registrar tus gastos escribiéndome o mandándome un ticket.';

export const MENSAJE_CUENTA_CREADA =
  '✅ ¡Cuenta creada y vinculada! Ya podés registrar tus gastos escribiéndome o mandándome un ticket.';

export function mensajeErrorAutenticacion(detalle: string): string {
  return `❌ No pude completar el acceso: ${detalle}. Reintentá con /start.`;
}
