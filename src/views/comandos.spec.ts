import { describe, expect, it } from 'vitest';
import {
  construirBotonComando,
  construirTecladoAccesos,
  construirTecladoAyuda,
  construirTecladoDespuesDeGuardar,
} from './comandos.js';
import { vistaBienvenida } from './bienvenida.js';
import { MENSAJE_AYUDA, construirTecladoAyudaRapido } from './ayuda.js';

describe('accesos rápidos', () => {
  it('cada botón ejecuta un comando del bot', () => {
    expect(construirBotonComando('resumen')).toEqual({
      text: '📊 Resumen',
      callback_data: 'cmd:resumen',
    });
    expect(construirBotonComando('eliminar').callback_data).toBe('cmd:eliminar');
  });

  it('el teclado de accesos agrupa los comandos en una fila', () => {
    const teclado = construirTecladoAccesos(['resumen', 'historial']);

    expect(teclado).toHaveLength(1);
    expect(teclado[0]?.map((boton) => boton.callback_data)).toEqual([
      'cmd:resumen',
      'cmd:historial',
    ]);
  });

  it('la ayuda ofrece todos los accesos', () => {
    const callbacks = construirTecladoAyuda()
      .flat()
      .map((boton) => boton.callback_data);

    expect(callbacks).toContain('cmd:resumen');
    expect(callbacks).toContain('cmd:historial');
    expect(callbacks).toContain('cmd:grafico');
    expect(callbacks).toContain('cmd:eliminar');
    expect(callbacks).toContain('cmd:modificar');
  });

  it('después de guardar sugiere los próximos pasos', () => {
    const callbacks = construirTecladoDespuesDeGuardar()
      .flat()
      .map((boton) => boton.callback_data);

    expect(callbacks).toEqual([
      'cmd:resumen',
      'cmd:historial',
      'cmd:eliminar',
      'cmd:modificar',
    ]);
  });
});

describe('pantalla de ayuda', () => {
  it('documenta todos los comandos principales', () => {
    for (const comando of [
      '/resumen',
      '/historial',
      '/grafico',
      '/eliminar',
      '/modificar',
      '/categoria',
    ]) {
      expect(MENSAJE_AYUDA).toContain(comando);
    }
  });

  it('el teclado de la ayuda tiene los accesos rápidos', () => {
    expect(construirTecladoAyudaRapido()).toEqual(construirTecladoAyuda());
  });
});

describe('pantalla de bienvenida', () => {
  it('explica cómo registrar un gasto y ofrece los accesos', () => {
    const vista = vistaBienvenida();
    const callbacks = vista.teclado.inline_keyboard
      .flat()
      .map((boton) =>
        'callback_data' in boton ? String(boton.callback_data) : '',
      );

    expect(vista.texto).toContain('Gasté 1500 en el Coto');
    expect(vista.texto).toContain('foto de un ticket');
    expect(callbacks).toContain('auth_login');
    expect(callbacks).toContain('auth_register');
    expect(callbacks).toContain('cmd:resumen');
    expect(callbacks).toContain('cmd:eliminar');
  });
});
