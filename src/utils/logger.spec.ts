import { describe, expect, it } from 'vitest';
import type { DestinationStream } from 'pino';
import { crearLogger, crearOpcionesPino } from './logger.js';

function crearDestino() {
  const lineas: string[] = [];
  const destino: DestinationStream = {
    write: (linea) => {
      lineas.push(linea);
    },
  };

  return { lineas, destino };
}

function leerRegistro(lineas: string[], indice = 0): Record<string, unknown> {
  const linea = lineas[indice];
  expect(linea).toBeDefined();
  expect(linea?.endsWith('\n')).toBe(true);

  return JSON.parse(linea ?? '{}') as Record<string, unknown>;
}

describe('logger', () => {
  it('escribe eventos info como JSON estructurado', () => {
    const { lineas, destino } = crearDestino();
    const logger = crearLogger({ destino, desarrollo: false });

    logger.info({ username: 'mangos_bot' }, 'Bot iniciado');

    const registro = leerRegistro(lineas);

    expect(registro).toMatchObject({
      level: 'info',
      service: 'bot-telegram',
      msg: 'Bot iniciado',
      username: 'mangos_bot',
    });
    expect(typeof registro.time).toBe('string');
  });

  it('incluye el nivel debug cuando está habilitado', () => {
    const { lineas, destino } = crearDestino();
    const logger = crearLogger({ destino, desarrollo: false, nivel: 'debug' });

    logger.debug({ paso: 1 }, 'detalle');

    expect(leerRegistro(lineas)).toMatchObject({ level: 'debug', paso: 1 });
  });

  it('respeta el nivel mínimo configurado', () => {
    const { lineas, destino } = crearDestino();
    const logger = crearLogger({ destino, desarrollo: false, nivel: 'warn' });

    logger.info('oculto');
    logger.warn('visible');

    expect(lineas).toHaveLength(1);
    expect(leerRegistro(lineas).level).toBe('warn');
  });

  it('registra errores con su contexto', () => {
    const { lineas, destino } = crearDestino();
    const logger = crearLogger({ destino, desarrollo: false });

    logger.error({ status: 500 }, 'falló api-gastos');

    expect(leerRegistro(lineas)).toMatchObject({
      level: 'error',
      msg: 'falló api-gastos',
      status: 500,
    });
  });

  it('en desarrollo usa pino-pretty con colores', () => {
    const opciones = crearOpcionesPino(true, 'info');

    expect(opciones.transport).toMatchObject({
      target: 'pino-pretty',
      options: { colorize: true },
    });
  });

  it('en producción no usa transporte', () => {
    expect(crearOpcionesPino(false, 'info').transport).toBeUndefined();
  });
});
