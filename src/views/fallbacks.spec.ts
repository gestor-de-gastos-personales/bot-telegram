import { describe, expect, it } from 'vitest';
import {
  FALLBACKS_IMAGEN,
  FALLBACKS_TEXTO,
  elegirMensaje,
  mensajeNoEntendidoImagen,
  mensajeNoEntendidoTexto,
} from './fallbacks.js';

describe('mensajes variados para UNKNOWN', () => {
  it('ofrece diez ejemplos distintos para texto', () => {
    expect(FALLBACKS_TEXTO).toHaveLength(10);
    expect(new Set(FALLBACKS_TEXTO).size).toBe(10);
  });

  it('ofrece diez sugerencias distintas para imágenes', () => {
    expect(FALLBACKS_IMAGEN).toHaveLength(10);
    expect(new Set(FALLBACKS_IMAGEN).size).toBe(10);
    expect(FALLBACKS_TEXTO).not.toEqual(FALLBACKS_IMAGEN);
  });

  it('elige el primer y último mensaje del pool', () => {
    expect(elegirMensaje(FALLBACKS_TEXTO, 0)).toBe(FALLBACKS_TEXTO[0]);
    expect(elegirMensaje(FALLBACKS_TEXTO, 0.999)).toBe(FALLBACKS_TEXTO[9]);
  });

  it('aclara los valores fuera de rango', () => {
    expect(elegirMensaje(FALLBACKS_TEXTO, -1)).toBe(FALLBACKS_TEXTO[0]);
    expect(elegirMensaje(FALLBACKS_TEXTO, 2)).toBe(FALLBACKS_TEXTO[9]);
  });

  it('distingue el origen del fallo', () => {
    expect(mensajeNoEntendidoTexto(0)).toContain('Gasté 1500');
    expect(mensajeNoEntendidoImagen(0)).toContain('ticket');
  });
});
