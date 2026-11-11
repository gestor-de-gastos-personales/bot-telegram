import { describe, expect, it } from 'vitest';
import { escapeHtml, formatearFecha, formatearMonto } from './format.js';

describe('escapeHtml', () => {
  it('escapa los caracteres reservados de Telegram', () => {
    expect(escapeHtml('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;');
  });

  it('deja intacto el texto sin caracteres reservados', () => {
    expect(escapeHtml('Supermercado')).toBe('Supermercado');
  });
});

describe('formatearMonto', () => {
  it('agrega el signo peso y el separador de miles', () => {
    expect(formatearMonto(1500)).toBe('$1.500');
    expect(formatearMonto('5000')).toBe('$5.000');
  });

  it('mantiene los decimales cuando los hay', () => {
    expect(formatearMonto(2500.5)).toBe('$2.500,5');
  });

  it('devuelve $0 cuando el monto no es un número', () => {
    expect(formatearMonto(null)).toBe('$0');
    expect(formatearMonto(undefined)).toBe('$0');
    expect(formatearMonto('no es un número')).toBe('$0');
  });
});

describe('formatearFecha', () => {
  it('muestra las fechas ISO como DD/MM/YYYY', () => {
    expect(formatearFecha('2026-11-06')).toBe('06/11/2026');
    expect(formatearFecha('2026-11-06T19:00:00.140Z')).toBe('06/11/2026');
  });

  it('avisa cuando no hay fecha', () => {
    expect(formatearFecha(null)).toBe('sin fecha');
    expect(formatearFecha(undefined)).toBe('sin fecha');
  });
});
