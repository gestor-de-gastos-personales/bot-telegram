import { beforeEach, describe, expect, it } from 'vitest';
import {
  capturarCredenciales,
  capturarEmail,
  esEmailValido,
  iniciarAutenticacion,
  MENSAJE_EMAIL_INVALIDO,
  MENSAJE_PASSWORD,
} from './auth.js';
import { crearSesionInicial } from './state/session.js';
import type { SessionData } from './state/session.js';

describe('utilidades de sesión', () => {
  it('crea sesiones vacías e independientes', () => {
    const primera = crearSesionInicial();
    const segunda = crearSesionInicial();

    primera.email = 'ana@mail.com';

    expect(segunda).toEqual({});
  });
});

describe('esEmailValido', () => {
  it('acepta emails con formato correcto', () => {
    expect(esEmailValido('ana@mail.com')).toBe(true);
    expect(esEmailValido('  usuario@dominio.com.ar  ')).toBe(true);
  });

  it('rechaza emails incompletos', () => {
    expect(esEmailValido('ana')).toBe(false);
    expect(esEmailValido('ana@mail')).toBe(false);
    expect(esEmailValido('ana @mail.com')).toBe(false);
    expect(esEmailValido('')).toBe(false);
  });
});

describe('flujo de autenticación', () => {
  let session: SessionData;

  beforeEach(() => {
    session = crearSesionInicial();
  });

  it('inicia el flujo de login pidiendo el email', () => {
    const mensaje = iniciarAutenticacion(session, 'LOGIN');

    expect(mensaje).toBe('📧 Por favor, ingresá tu email:');
    expect(session).toEqual({ accion: 'LOGIN', step: 'AWAITING_EMAIL' });
  });

  it('inicia el flujo de registro con su propio mensaje', () => {
    const mensaje = iniciarAutenticacion(session, 'REGISTER');

    expect(mensaje).toBe('📧 Por favor, ingresá el email para tu nueva cuenta:');
    expect(session.accion).toBe('REGISTER');
    expect(session.step).toBe('AWAITING_EMAIL');
  });

  it('descarta un email anterior al reiniciar el flujo', () => {
    session.email = 'viejo@mail.com';

    iniciarAutenticacion(session, 'LOGIN');

    expect(session.email).toBeUndefined();
  });

  it('guarda un email válido y avanza al paso de contraseña', () => {
    iniciarAutenticacion(session, 'LOGIN');

    const mensaje = capturarEmail(session, '  ana@mail.com  ');

    expect(mensaje).toBe(MENSAJE_PASSWORD);
    expect(session.email).toBe('ana@mail.com');
    expect(session.step).toBe('AWAITING_PASSWORD');
  });

  it('no avanza si el email es inválido', () => {
    iniciarAutenticacion(session, 'REGISTER');

    const mensaje = capturarEmail(session, 'no-es-un-email');

    expect(mensaje).toBe(MENSAJE_EMAIL_INVALIDO);
    expect(session.email).toBeUndefined();
    expect(session.step).toBe('AWAITING_EMAIL');
  });

  it('devuelve las credenciales y limpia la sesión en el login', () => {
    iniciarAutenticacion(session, 'LOGIN');
    capturarEmail(session, 'ana@mail.com');

    const credenciales = capturarCredenciales(session, '  secreto123  ');

    expect(credenciales).toEqual({
      accion: 'LOGIN',
      email: 'ana@mail.com',
      password: 'secreto123',
    });
    expect(session.email).toBeUndefined();
    expect(session.step).toBeUndefined();
    expect(session.accion).toBeUndefined();
  });

  it('conserva la acción de registro al capturar la contraseña', () => {
    iniciarAutenticacion(session, 'REGISTER');
    capturarEmail(session, 'nueva@mail.com');

    const credenciales = capturarCredenciales(session, 'secreto123');

    expect(credenciales?.accion).toBe('REGISTER');
  });

  it('no entrega credenciales si la sesión está incompleta', () => {
    iniciarAutenticacion(session, 'LOGIN');

    expect(capturarCredenciales(session, 'secreto123')).toBeNull();
  });

  it('no entrega credenciales si no se está esperando la contraseña', () => {
    expect(capturarCredenciales(crearSesionInicial(), 'secreto123')).toBeNull();
  });

  it('completa el flujo de login de punta a punta', () => {
    iniciarAutenticacion(session, 'LOGIN');
    capturarEmail(session, 'ana@mail.com');
    const credenciales = capturarCredenciales(session, 'secreto123');

    expect(credenciales).toEqual({
      accion: 'LOGIN',
      email: 'ana@mail.com',
      password: 'secreto123',
    });
  });

  it('completa el flujo de registro de punta a punta', () => {
    iniciarAutenticacion(session, 'REGISTER');
    capturarEmail(session, 'nueva@mail.com');
    const credenciales = capturarCredenciales(session, 'secreto123');

    expect(credenciales).toEqual({
      accion: 'REGISTER',
      email: 'nueva@mail.com',
      password: 'secreto123',
    });
  });
});
