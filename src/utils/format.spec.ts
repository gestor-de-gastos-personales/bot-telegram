import { describe, expect, it } from 'vitest';
import { construirVistaPrevia, escapeHtml, mensajeDeError } from './format.js';
import type { GastoAnalizado } from '../services/ia.service.js';

const gasto: GastoAnalizado = {
  intent: 'GASTO',
  monto: 1500,
  comercio: 'Coto <Centro>',
  categoria: 'Alimentación & Bebidas',
  descripcion: 'Compra "semanal"',
};

describe('escapeHtml', () => {
  it('escapa los caracteres reservados de Telegram', () => {
    expect(escapeHtml('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;');
  });

  it('deja intacto el texto sin caracteres reservados', () => {
    expect(escapeHtml('Supermercado')).toBe('Supermercado');
  });
});

describe('construirVistaPrevia', () => {
  it('incluye monto, comercio, categoría y descripción', () => {
    const vista = construirVistaPrevia(gasto);

    expect(vista).toContain('$1500');
    expect(vista).toContain('Coto &lt;Centro&gt;');
    expect(vista).toContain('Alimentación &amp; Bebidas');
    expect(vista).toContain('Compra "semanal"');
  });

  it('usa valores por defecto cuando faltan datos', () => {
    const vista = construirVistaPrevia({
      intent: 'UNKNOWN',
      monto: null,
      comercio: null,
      categoria: null,
      descripcion: null,
    });

    expect(vista).toContain('Monto:</b> $-');
    expect(vista).toContain('Categoría:</b> Varios');
    expect(vista).toContain('Comercio:</b> -');
  });
});

describe('mensajeDeError', () => {
  it('devuelve el mensaje de una instancia de Error', () => {
    expect(mensajeDeError(new Error('falló la red'))).toBe('falló la red');
  });

  it('devuelve un mensaje genérico para valores desconocidos', () => {
    expect(mensajeDeError('texto suelto')).toBe('Error inesperado');
    expect(mensajeDeError(null)).toBe('Error inesperado');
  });
});
