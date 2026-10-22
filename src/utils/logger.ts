/**
 * Logger estructurado del bot.
 *
 * Emite una línea JSON por evento para que los logs puedan ser procesados
 * por herramientas de observabilidad. No usa salidas de consola: escribe
 * sobre los streams estándar para mantener el formato uniforme y no dejar
 * rastros de depuración sueltos en el código.
 */

export type NivelLog = 'debug' | 'info' | 'warn' | 'error';

export type ContextoLog = Record<string, unknown>;

interface Registro {
  timestamp: string;
  level: NivelLog;
  service: 'bot-telegram';
  message: string;
  [clave: string]: unknown;
}

function serializar(nivel: NivelLog, mensaje: string, contexto?: ContextoLog): string {
  const registro: Registro = {
    timestamp: new Date().toISOString(),
    level: nivel,
    service: 'bot-telegram',
    message: mensaje,
    ...contexto,
  };

  return `${JSON.stringify(registro)}\n`;
}

function escribir(nivel: NivelLog, mensaje: string, contexto?: ContextoLog): void {
  const linea = serializar(nivel, mensaje, contexto);

  if (nivel === 'error' || nivel === 'warn') {
    process.stderr.write(linea);
    return;
  }

  process.stdout.write(linea);
}

export const logger = {
  debug(mensaje: string, contexto?: ContextoLog): void {
    escribir('debug', mensaje, contexto);
  },
  info(mensaje: string, contexto?: ContextoLog): void {
    escribir('info', mensaje, contexto);
  },
  warn(mensaje: string, contexto?: ContextoLog): void {
    escribir('warn', mensaje, contexto);
  },
  error(mensaje: string, contexto?: ContextoLog): void {
    escribir('error', mensaje, contexto);
  },
};
