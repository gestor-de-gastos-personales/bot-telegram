import pino from 'pino';
import type { DestinationStream, Logger, LoggerOptions } from 'pino';

/**
 * Logger estructurado del bot basado en pino.
 *
 * - Desarrollo: `pino-pretty` con colores para una consola legible.
 * - Producción: una línea JSON por evento, lista para observabilidad.
 * - Tests: sin transporte, para poder capturar la salida con un destino propio.
 */

export type NivelLog = 'debug' | 'info' | 'warn' | 'error';

export type ContextoLog = Record<string, unknown>;

export interface OpcionesLogger {
  nivel?: string;
  destino?: DestinationStream;
  desarrollo?: boolean;
}

function esEntornoDesarrollo(): boolean {
  return (
    process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
  );
}

/** Opciones de pino según entorno; exportadas para poder testearlas. */
export function crearOpcionesPino(
  desarrollo: boolean,
  nivel: string,
): LoggerOptions {
  const opciones: LoggerOptions = {
    level: nivel,
    base: { service: 'bot-telegram' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (etiqueta) => ({ level: etiqueta }),
    },
  };

  if (!desarrollo) {
    return opciones;
  }

  return {
    ...opciones,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
        singleLine: true,
      },
    },
  };
}

/**
 * Crea un logger pino. Permite inyectar un destino en tests para inspeccionar
 * los registros sin depender de los streams del proceso.
 */
export function crearLogger(opciones: OpcionesLogger = {}): Logger {
  const nivel = opciones.nivel ?? (process.env.LOG_LEVEL || 'info');
  const desarrollo = opciones.desarrollo ?? esEntornoDesarrollo();

  if (opciones.destino) {
    return pino(crearOpcionesPino(false, nivel), opciones.destino);
  }

  return pino(crearOpcionesPino(desarrollo, nivel));
}

export const logger = crearLogger();
