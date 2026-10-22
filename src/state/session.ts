import type { GastoAnalizado } from '../services/ia.service.js';

/**
 * Pasos del flujo de autenticación que se guardan en la sesión de grammY.
 */
export type PasoAutenticacion = 'AWAITING_EMAIL' | 'AWAITING_PASSWORD';

/**
 * Acción que el usuario eligió desde los botones de /start.
 */
export type AccionAutenticacion = 'LOGIN' | 'REGISTER';

export interface SessionData {
  step?: PasoAutenticacion;
  email?: string;
  accion?: AccionAutenticacion;
  pendingExpense?: GastoAnalizado;
}

/**
 * Cada usuario arranca con una sesión vacía e independiente.
 */
export function crearSesionInicial(): SessionData {
  return {};
}

/**
 * Limpia los datos sensibles de la sesión (email y contraseña no se guardan).
 */
export function limpiarSesion(session: SessionData): void {
  delete session.step;
  delete session.email;
  delete session.accion;
  delete session.pendingExpense;
}
