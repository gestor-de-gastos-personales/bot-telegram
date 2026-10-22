import { describe, expect, it } from 'vitest';
import { escapeHtml } from './format.js';

describe('escapeHtml', () => {
  it('escapa los caracteres reservados de Telegram', () => {
    expect(escapeHtml('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;');
  });

  it('deja intacto el texto sin caracteres reservados', () => {
    expect(escapeHtml('Supermercado')).toBe('Supermercado');
  });
});
