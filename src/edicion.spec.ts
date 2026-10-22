import { describe, expect, it } from 'vitest';
import { interpretarEdicion, parsearFecha, parsearMonto } from './edicion.js';
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

const AHORA = new Date('2026-10-22T15:00:00.000Z');

describe('parsearMonto', () => {
  it.each([
    ['$1.500,50', 1500.5],
    ['1500,50', 1500.5],
    ['1.500', 1500],
    ['800', 800],
  ])('normaliza el monto %s', (entrada, esperado) => {
    expect(parsearMonto(entrada)).toBe(esperado);
  });

  it('rechaza montos inválidos o no positivos', () => {
    expect(parsearMonto('abc')).toBeNull();
    expect(parsearMonto('0')).toBeNull();
    expect(parsearMonto('-5')).toBeNull();
  });
});

describe('parsearFecha', () => {
  it('resuelve expresiones relativas', () => {
    expect(parsearFecha('hoy', AHORA)).toBe('2026-10-22');
    expect(parsearFecha('ayer', AHORA)).toBe('2026-10-21');
    expect(parsearFecha('anteayer', AHORA)).toBe('2026-10-20');
  });

  it('resuelve el último día de la semana mencionado', () => {
    expect(parsearFecha('el lunes', AHORA)).toBe('2026-10-19');
  });

  it('acepta fechas explícitas en ISO o DD/MM', () => {
    expect(parsearFecha('2026-09-15', AHORA)).toBe('2026-09-15');
    expect(parsearFecha('15/09/2026', AHORA)).toBe('2026-09-15');
    expect(parsearFecha('15/09', AHORA)).toBe('2026-09-15');
  });

  it('devuelve null cuando no reconoce la fecha', () => {
    expect(parsearFecha('la semana que viene', AHORA)).toBeNull();
  });
});

describe('interpretarEdicion', () => {
  it('cambia el monto con "el precio es ..."', () => {
    const resultado = interpretarEdicion(gasto, 'el precio es 2500', AHORA);

    expect(resultado?.gasto.monto).toBe(2500);
    expect(resultado?.cambio).toContain('2500');
  });

  it('cambia el monto con un número suelto', () => {
    expect(interpretarEdicion(gasto, '1800', AHORA)?.gasto.monto).toBe(1800);
    expect(interpretarEdicion(gasto, '$1.500,50', AHORA)?.gasto.monto).toBe(
      1500.5,
    );
  });

  it('cambia el monto con "en realidad fueron ..."', () => {
    expect(interpretarEdicion(gasto, 'en realidad fueron 900', AHORA)?.gasto.monto).toBe(
      900,
    );
  });

  it('no muta el gasto original', () => {
    interpretarEdicion(gasto, 'el precio es 2500', AHORA);

    expect(gasto.monto).toBe(1000);
  });

  it('cambia el comercio', () => {
    expect(
      interpretarEdicion(gasto, 'el comercio es Farmacia', AHORA)?.gasto.comercio,
    ).toBe('Farmacia');
    expect(interpretarEdicion(gasto, 'era en Carrefour', AHORA)?.gasto.comercio).toBe(
      'Carrefour',
    );
  });

  it('cambia la categoría', () => {
    expect(
      interpretarEdicion(gasto, 'la categoría es Transporte', AHORA)?.gasto.categoria,
    ).toBe('Transporte');
  });

  it('cambia la descripción', () => {
    expect(
      interpretarEdicion(gasto, 'la descripción es Cena con amigos', AHORA)?.gasto
        .descripcion,
    ).toBe('Cena con amigos');
    expect(interpretarEdicion(gasto, 'ponele Nafta', AHORA)?.gasto.descripcion).toBe(
      'Nafta',
    );
  });

  it('cambia la fecha indicada por el usuario', () => {
    expect(interpretarEdicion(gasto, 'la fecha es ayer', AHORA)?.gasto.fecha).toBe(
      '2026-10-21',
    );
  });

  it('descarta el valor cuando un monto explícito es inválido', () => {
    const resultado = interpretarEdicion(gasto, 'el precio es abc', AHORA);

    expect(resultado).toBeNull();
  });

  it('devuelve null si el texto no expresa una corrección', () => {
    expect(interpretarEdicion(gasto, 'hola, ¿cómo va?', AHORA)).toBeNull();
    expect(interpretarEdicion(gasto, 'quiero más info', AHORA)).toBeNull();
  });
});
