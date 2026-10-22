import type { AccionAutenticacion, SessionData } from './state/session.js';

export const MENSAJE_EMAIL_INVALIDO =
  '⚠️ El email no parece válido. Ingresá uno con el formato usuario@dominio.com:';

export const MENSAJE_PASSWORD = '🔑 Ahora ingresá tu contraseña:';

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CredencialesCapturadas {
  accion: AccionAutenticacion;
  email: string;
  password: string;
}

export function esEmailValido(email: string): boolean {
  return PATRON_EMAIL.test(email.trim());
}

/**
 * Inicia el flujo de login o registro desde un botón de /start.
 * Devuelve el mensaje que hay que responderle al usuario.
 */
export function iniciarAutenticacion(
  session: SessionData,
  accion: AccionAutenticacion,
): string {
  session.accion = accion;
  session.step = 'AWAITING_EMAIL';
  delete session.email;

  return accion === 'LOGIN'
    ? '📧 Por favor, ingresá tu email:'
    : '📧 Por favor, ingresá el email para tu nueva cuenta:';
}

/**
 * Guarda el email si es válido y avanza al paso de contraseña.
 */
export function capturarEmail(session: SessionData, texto: string): string {
  const email = texto.trim();

  if (!esEmailValido(email)) {
    return MENSAJE_EMAIL_INVALIDO;
  }

  session.email = email;
  session.step = 'AWAITING_PASSWORD';

  return MENSAJE_PASSWORD;
}

/**
 * Cierra la captura de credenciales y limpia los datos de la sesión.
 * Devuelve `null` si la sesión no estaba esperando una contraseña.
 */
export function capturarCredenciales(
  session: SessionData,
  texto: string,
): CredencialesCapturadas | null {
  if (session.step !== 'AWAITING_PASSWORD' || !session.email || !session.accion) {
    return null;
  }

  const credenciales: CredencialesCapturadas = {
    accion: session.accion,
    email: session.email,
    password: texto.trim(),
  };

  delete session.step;
  delete session.email;
  delete session.accion;

  return credenciales;
}
