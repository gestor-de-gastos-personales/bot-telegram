import type { GastoAnalizado } from '../services/ia.service.js';

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
  /** Evita confirmaciones o cancelaciones duplicadas por doble clic. */
  procesando?: boolean;
  recurringStep?: 'ASK_IF_RECURRING' | 'ASK_FREQUENCY' | 'ASK_DAY' | 'CONFIRM_AFTER_RECURRING';
  pendingRecurring?: GastoAnalizado & { telegramId?: string; quiereRecurrente?: boolean };
  pendingDelete?: { gastoId: number; monto: number; descripcion: string; fecha: string; categoria?: string };
  pendingEdit?: { gastoId: number; gasto: Record<string, unknown>; campoPendiente?: string };
  pendingShow?: { gastoId: number; gasto: Record<string, unknown> };
  /** Gasto con pista de recurrencia esperando respuesta antes de confirmación */
  pendingRecurringCheck?: GastoAnalizado & { origen?: 'texto' | 'imagen' };
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
  delete session.procesando;
  delete session.recurringStep;
  delete session.pendingRecurring;
  delete session.pendingDelete;
  delete session.pendingEdit;
  delete session.pendingRecurringCheck;
}
