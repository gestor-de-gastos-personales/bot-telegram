import { describe, expect, it } from 'vitest';
import { interpretarPeriodo } from './periodo.js';

const HOY = new Date(Date.UTC(2026, 10, 6, 12));

describe('interpretarPeriodo', () => {
  it('reconoce las palabras de período', () => {
    expect(interpretarPeriodo('hoy', HOY)).toEqual({
      tipo: 'rango',
      rango: 'TODAY',
    });
    expect(interpretarPeriodo('semana', HOY)).toEqual({
      tipo: 'rango',
      rango: 'WEEK',
    });
    expect(interpretarPeriodo('mes', HOY)).toEqual({
      tipo: 'rango',
      rango: 'MONTH',
    });
    expect(interpretarPeriodo('año', HOY)).toEqual({
      tipo: 'rango',
      rango: 'YEAR',
    });
    expect(interpretarPeriodo('anio', HOY)).toEqual({
      tipo: 'rango',
      rango: 'YEAR',
    });
  });

  it('ignora mayúsculas y espacios sobrantes', () => {
    expect(interpretarPeriodo('  MES  ', HOY)).toEqual({
      tipo: 'rango',
      rango: 'MONTH',
    });
  });

  it('interpreta una fecha suelta como rango desde esa fecha hasta hoy', () => {
    expect(interpretarPeriodo('010126', HOY)).toEqual({
      tipo: 'fechas',
      desde: '2026-01-01',
      hasta: '2026-11-06',
    });
  });

  it('interpreta un rango de dos fechas', () => {
    expect(interpretarPeriodo('011026 311026', HOY)).toEqual({
      tipo: 'fechas',
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
  });

  it('marca el rango cuando las fechas vienen invertidas', () => {
    expect(interpretarPeriodo('311026 011026', HOY)).toEqual({
      tipo: 'fechas',
      desde: '2026-10-01',
      hasta: '2026-10-31',
      invertido: true,
    });
  });

  it('devuelve null cuando no entiende el período', () => {
    expect(interpretarPeriodo('el año pasado', HOY)).toBeNull();
    expect(interpretarPeriodo('', HOY)).toBeNull();
  });
});
