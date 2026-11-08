import { describe, expect, it } from 'vitest';
import {
  ETIQUETA_ANTERIOR,
  ETIQUETA_SIGUIENTE,
  construirFilaPaginacion,
  etiquetaPagina,
} from './teclado.js';
import { construirTecladoPaginacion } from './acciones.js';
import { construirTecladoHistorial } from '../handlers/historial.js';

describe('formato estándar de paginación', () => {
  it('usa las mismas etiquetas en todas las listas', () => {
    const eliminar = construirTecladoPaginacion(2, 5, 'eliminar')[0]!;
    const modificar = construirTecladoPaginacion(2, 5, 'modificar')[0]!;
    const historial = construirTecladoHistorial(
      { page: 2, totalPages: 5, total: 50, limit: 10 },
      [],
    ).at(-1)!;

    for (const fila of [eliminar, modificar, historial]) {
      expect(fila[0]?.text).toBe('« Anterior');
      expect(fila[1]?.text).toBe('Página 2/5');
      expect(fila[2]?.text).toBe('Siguiente »');
    }
  });

  it('en la primera página no muestra Anterior', () => {
    const fila = construirFilaPaginacion(1, 3, {
      anterior: 'x:1',
      siguiente: 'x:2',
      noop: 'x:noop',
    });

    expect(fila.map((b) => b.text)).toEqual(['Página 1/3', 'Siguiente »']);
  });

  it('en la última página no muestra Siguiente', () => {
    const fila = construirFilaPaginacion(3, 3, {
      anterior: 'x:2',
      siguiente: 'x:4',
      noop: 'x:noop',
    });

    expect(fila.map((b) => b.text)).toEqual(['« Anterior', 'Página 3/3']);
  });

  it('expone las etiquetas y el texto de página', () => {
    expect(ETIQUETA_ANTERIOR).toBe('« Anterior');
    expect(ETIQUETA_SIGUIENTE).toBe('Siguiente »');
    expect(etiquetaPagina(2, 7)).toBe('Página 2/7');
  });
});
