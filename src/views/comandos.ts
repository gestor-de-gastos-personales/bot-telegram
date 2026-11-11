/**
 * Accesos rápidos a los comandos del bot.
 *
 * Los botones usan el callback `cmd:<comando>` para que el usuario pueda
 * llegar a cada función sin escribir nada.
 */
import type { BotonInline } from './teclado.js';

/** Comandos que se pueden ejecutar desde un botón. */
export type ComandoRapido =
  | 'resumen'
  | 'historial'
  | 'grafico'
  | 'eliminar'
  | 'modificar'
  | 'ayuda';

const ETIQUETAS: Record<ComandoRapido, string> = {
  resumen: '📊 Resumen',
  historial: '📋 Historial',
  grafico: '📈 Gráfico',
  eliminar: '🗑️ Eliminar',
  modificar: '✏️ Modificar',
  ayuda: '❓ Ayuda',
};

/** Botón de acceso rápido a un comando. */
export function construirBotonComando(comando: ComandoRapido): BotonInline {
  return { text: ETIQUETAS[comando], callback_data: `cmd:${comando}` };
}

/** Teclado con los accesos rápidos más usados. */
export function construirTecladoAccesos(
  comandos: ComandoRapido[] = ['resumen', 'historial', 'grafico'],
): BotonInline[][] {
  return [comandos.map((comando) => construirBotonComando(comando))];
}

/**
 * Teclado de la pantalla de ayuda: una fila por bloque de comandos.
 */
export function construirTecladoAyuda(): BotonInline[][] {
  return [
    [
      construirBotonComando('resumen'),
      construirBotonComando('historial'),
    ],
    [
      construirBotonComando('grafico'),
      construirBotonComando('eliminar'),
    ],
    [construirBotonComando('modificar')],
  ];
}

/**
 * Teclado que se muestra después de guardar un gasto, para sugerir el
 * siguiente paso.
 */
export function construirTecladoDespuesDeGuardar(): BotonInline[][] {
  return [
    [
      construirBotonComando('resumen'),
      construirBotonComando('historial'),
    ],
    [construirBotonComando('eliminar'), construirBotonComando('modificar')],
  ];
}
