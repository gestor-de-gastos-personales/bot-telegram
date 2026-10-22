import { describe, expect, it } from 'vitest';
import {
  aplicarEdicion,
  MENSAJE_MONTO_INVALIDO,
  MENSAJE_TEXTO_VACIO,
} from './edicion.js';
import type { GastoAnalizado } from './services/ia.service.js';

const gasto: GastoAnalizado = {
  intent: 'CREATE_EXPENSE',
  monto: 1000,
  comercio: 'Coto',
  categoria: 'Alimentación',
  descripcion: 'Compra',
  fecha: '2026-10-20',
  rango: null,
};

describe('aplicarEdicion', () => {
  it('actualiza el monto sin mutar el gasto original', () => {
    const resultado = aplicarEdicion(gasto, 'monto', '2500.5');

    expect(resultado.gasto.monto).toBe(2500.5);
    expect(resultado.error).toBeUndefined();
    expect(gasto.monto).toBe(1000);
  });

  it.each([
    ['$1.500,50', 1500.5],
    ['1500,50', 1500.5],
    ['1.500', 1500],
    ['800', 800],
  ])('normaliza el monto %s', (entrada, esperado) => {
    expect(aplicarEdicion(gasto, 'monto', entrada).gasto.monto).toBe(esperado);
  });

  it('rechaza montos inválidos o no positivos', () => {
    expect(aplicarEdicion(gasto, 'monto', 'abc').error).toBe(
      MENSAJE_MONTO_INVALIDO,
    );
    expect(aplicarEdicion(gasto, 'monto', '0').gasto.monto).toBe(1000);
  });

  it('actualiza la descripción recortando espacios', () => {
    const resultado = aplicarEdicion(gasto, 'descripcion', '  Cena  ');

    expect(resultado.gasto.descripcion).toBe('Cena');
  });

  it('actualiza la categoría', () => {
    expect(aplicarEdicion(gasto, 'categoria', 'Transporte').gasto.categoria).toBe(
      'Transporte',
    );
  });

  it('rechaza descripciones o categorías vacías', () => {
    expect(aplicarEdicion(gasto, 'descripcion', '   ').error).toBe(
      MENSAJE_TEXTO_VACIO,
    );
    expect(aplicarEdicion(gasto, 'categoria', '').error).toBe(
      MENSAJE_TEXTO_VACIO,
    );
  });
});
