import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger.js';

describe('logger', () => {
  let stdout: ReturnType<typeof vi.spyOn>;
  let stderr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function leerRegistro(spy: ReturnType<typeof vi.spyOn>, indice = 0) {
    const llamada = spy.mock.calls[indice];
    expect(llamada).toBeDefined();

    const linea = String(llamada?.[0]);
    expect(linea.endsWith('\n')).toBe(true);

    return JSON.parse(linea) as Record<string, unknown>;
  }

  it('escribe los eventos info como JSON en stdout', () => {
    logger.info('Bot iniciado', { username: 'mangos_bot' });

    const registro = leerRegistro(stdout);

    expect(registro).toMatchObject({
      level: 'info',
      service: 'bot-telegram',
      message: 'Bot iniciado',
      username: 'mangos_bot',
    });
    expect(typeof registro.timestamp).toBe('string');
    expect(stderr).not.toHaveBeenCalled();
  });

  it('incluye el nivel debug en stdout', () => {
    logger.debug('detalle', { paso: 1 });

    expect(leerRegistro(stdout)).toMatchObject({ level: 'debug', paso: 1 });
  });

  it('deriva las advertencias a stderr', () => {
    logger.warn('sin gasto pendiente');

    expect(leerRegistro(stderr)).toMatchObject({
      level: 'warn',
      message: 'sin gasto pendiente',
    });
    expect(stdout).not.toHaveBeenCalled();
  });

  it('deriva los errores a stderr', () => {
    logger.error('falló api-gastos', { status: 500 });

    expect(leerRegistro(stderr)).toMatchObject({
      level: 'error',
      status: 500,
    });
    expect(stdout).not.toHaveBeenCalled();
  });
});
