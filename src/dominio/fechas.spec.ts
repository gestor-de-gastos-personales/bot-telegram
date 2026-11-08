import { describe, expect, it } from 'vitest';
import {
  aIso,
  esFechaValida,
  formatearFechaES,
  parsearFecha,
  parsearRango,
} from './fechas.js';

const HOY = new Date('2026-10-30T12:00:00.000Z');

describe('fechas', () => {
  it('convierte a ISO', () => {
    expect(aIso(HOY)).toBe('2026-10-30');
  });

  it('muestra las fechas como DD/MM/YYYY', () => {
    expect(formatearFechaES('2026-12-01')).toBe('01/12/2026');
  });

  it('valida fechas del calendario', () => {
    expect(esFechaValida(2026, 10, 30)).toBe(true);
    expect(esFechaValida(2026, 13, 1)).toBe(false);
    expect(esFechaValida(2026, 2, 30)).toBe(false);
    expect(esFechaValida(2024, 2, 29)).toBe(true);
  });

  it('parsea 6 dígitos sin separadores (DDMMAA)', () => {
    expect(parsearFecha('011226', HOY)).toBe('2026-12-01');
    expect(parsearFecha('300926', HOY)).toBe('2026-09-30');
  });

  it('parsea 8 dígitos (DDMMAAAA)', () => {
    expect(parsearFecha('01122025', HOY)).toBe('2025-12-01');
  });

  it('asume el año actual si no se indica', () => {
    expect(parsearFecha('0112', HOY)).toBe('2026-12-01');
  });

  it('asume el mes y el año actuales si solo indica el día', () => {
    expect(parsearFecha('01', HOY)).toBe('2026-10-01');
    expect(parsearFecha('15', HOY)).toBe('2026-10-15');
  });

  it('parsea fechas con separadores', () => {
    expect(parsearFecha('1/12/26', HOY)).toBe('2026-12-01');
    expect(parsearFecha('1-12-2026', HOY)).toBe('2026-12-01');
    expect(parsearFecha('1.12.2026', HOY)).toBe('2026-12-01');
  });

  it('entiende hoy y ayer', () => {
    expect(parsearFecha('hoy', HOY)).toBe('2026-10-30');
    expect(parsearFecha('ayer', HOY)).toBe('2026-10-29');
  });

  it('rechaza fechas imposibles', () => {
    expect(parsearFecha('320126', HOY)).toBeNull();
    expect(parsearFecha('139926', HOY)).toBeNull();
    expect(parsearFecha('no hay fecha', HOY)).toBeNull();
    expect(parsearFecha('', HOY)).toBeNull();
  });

  it('interpreta 4 dígitos como DDMM y, si no cierra, como MMDD', () => {
    expect(parsearFecha('1301', HOY)).toBe('2026-01-13');
    expect(parsearFecha('0112', HOY)).toBe('2026-12-01');
  });

  it('parsea un rango con dos fechas', () => {
    expect(parsearRango('011226 311226', HOY)).toEqual({
      desde: '2026-12-01',
      hasta: '2026-12-31',
    });
  });

  it('parsea un rango con guion o palabras', () => {
    expect(parsearRango('011226-311226', HOY)).toEqual({
      desde: '2026-12-01',
      hasta: '2026-12-31',
    });
    expect(parsearRango('del 01/10 al 31/10', HOY)).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
    expect(parsearRango('01/10/2026 hasta 31/10/2026', HOY)).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-31',
    });
  });

  it('con una sola fecha el rango termina hoy', () => {
    expect(parsearRango('300926', HOY)).toEqual({
      desde: '2026-09-30',
      hasta: '2026-10-30',
    });
  });

  it('devuelve null cuando no entiende nada', () => {
    expect(parsearRango('octubre', HOY)).toBeNull();
    expect(parsearRango('', HOY)).toBeNull();
  });

  it('corrige el rango cuando las fechas vienen al revés', () => {
    const rango = parsearRango('311226 011226', HOY);

    expect(rango).toEqual({
      desde: '2026-12-01',
      hasta: '2026-12-31',
      invertido: true,
    });
  });

  it('corrige una fecha única que cae en el futuro', () => {
    const rango = parsearRango('011226', HOY);

    expect(rango?.desde).toBe('2026-10-30');
    expect(rango?.hasta).toBe('2026-12-01');
    expect(rango?.invertido).toBe(true);
  });
});
