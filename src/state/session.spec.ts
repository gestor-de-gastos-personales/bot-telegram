import { describe, expect, it } from 'vitest';
import { crearSesionInicial, limpiarSesion } from './session.js';
import type { SessionData } from './session.js';
import type { GastoAnalizado } from '../services/ia.service.js';

function gastoAnalizado(): GastoAnalizado {
  return {
    intent: 'CREATE_EXPENSE',
    monto: 100,
    comercio: 'Coto',
    categoria: 'Alimentación',
    descripcion: 'Compra',
    fecha: '2026-10-01',
    rango: null,
  };
}

describe('sesión', () => {
  it('crea una sesión vacía e independiente por usuario', () => {
    const primera = crearSesionInicial();
    const segunda = crearSesionInicial();

    expect(primera).toEqual({});
    expect(segunda).toEqual({});
    expect(primera).not.toBe(segunda);
  });

  it('limpia todos los datos sensibles y pendientes', () => {
    const session: SessionData = {
      step: 'AWAITING_PASSWORD',
      email: 'bruno@test.com',
      accion: 'LOGIN',
      pendingExpense: gastoAnalizado(),
      procesando: true,
      recurringStep: 'ASK_FREQUENCY',
      pendingRecurring: gastoAnalizado(),
      pendingDelete: {
        gastoId: 1,
        monto: 100,
        descripcion: 'Coto',
        fecha: '2026-10-01',
      },
      pendingEdit: { gastoId: 1, gasto: {} },
      pendingRecurringCheck: gastoAnalizado(),
    };

    limpiarSesion(session);

    expect(session).toEqual({});
  });
});
