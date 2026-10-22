import { describe, expect, it } from 'vitest';
import { InlineKeyboard } from 'grammy';
import type { GastoAnalizado } from '../services/ia.service.js';
import type { ResumenGastos } from '../services/gastos.service.js';
import { construirVistaPrevia, formatearFechaGasto, PISTA_EDICION, tecladoConfirmacion } from './gasto-preview.js';
import { formatearResumen, ETIQUETAS_RANGO } from './resumen.js';
import { mensajeDeError, mensajeErrorGenerico } from './errores.js';
import {
  MENSAJE_CANCELADO,
  MENSAJE_GASTO_GUARDADO,
  mensajeErrorGuardado,
} from './confirmacion.js';
import { MENSAJE_CUENTA_CREADA } from './autenticacion.js';
import { MENSAJE_AYUDA } from './ayuda.js';
import {
  MENSAJE_CATEGORIA_INVALIDA,
  mensajeCategoriaCreada,
  mensajeErrorCategoria,
  mensajeUsoCategoria,
} from './categoria.js';

const gasto: GastoAnalizado = {
  intent: 'GASTO',
  monto: 1500,
  comercio: 'Coto <Centro>',
  categoria: 'Alimentación & Bebidas',
  descripcion: 'Compra "semanal"',
  fecha: '2026-10-20',
  rango: null,
};

const resumen: ResumenGastos = {
  periodo: {
    mes: 10,
    anio: 2026,
    fechaInicio: '2026-10-01T00:00:00.000Z',
    fechaFin: '2026-10-31T23:59:59.999Z',
  },
  totalGeneral: 3000,
  porCategoria: [
    {
      categoriaId: 1,
      categoriaNombre: 'Alimentación & Bebidas',
      total: 2000,
      porcentaje: 66.67,
    },
    {
      categoriaId: 2,
      categoriaNombre: 'Transporte',
      total: 1000,
      porcentaje: 33.33,
    },
  ],
};

describe('vista previa del gasto', () => {
  it('incluye monto, comercio, categoría y descripción escapados', () => {
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
      fecha: null,
      rango: null,
    });

    expect(vista).toContain('Monto:</b> $-');
    expect(vista).toContain('Categoría:</b> Varios');
    expect(vista).toContain('Comercio:</b> -');
  });

  it('arma el teclado de confirmación con las dos acciones', () => {
    expect(tecladoConfirmacion()).toBeInstanceOf(InlineKeyboard);
  });

  it('muestra la fecha del gasto y asume hoy cuando falta', () => {
    expect(construirVistaPrevia(gasto)).toContain('Fecha:</b> 20/10/2026');
    expect(formatearFechaGasto(null)).toBe('hoy');
  });

  it('sugiere corregir el gasto por texto', () => {
    const vista = construirVistaPrevia(gasto);

    expect(vista).toContain(PISTA_EDICION);
    expect(PISTA_EDICION).toContain('el precio es');
  });
});

describe('vista de resumen', () => {
  it('renderiza el período, el total y cada categoría', () => {
    const texto = formatearResumen(resumen);

    expect(texto).toContain('Resumen de 10/2026');
    expect(texto).toContain('Total:</b> $3000');
    expect(texto).toContain('Alimentación &amp; Bebidas: $2000 (66.67%)');
    expect(texto).toContain('Transporte: $1000 (33.33%)');
  });

  it('avisa cuando no hay gastos en el período', () => {
    const texto = formatearResumen({
      periodo: { mes: null, anio: 2026, fechaInicio: '', fechaFin: '' },
      totalGeneral: 0,
      porCategoria: [],
    });

    expect(texto).toContain('Resumen de año 2026');
    expect(texto).toContain('No hay gastos registrados');
  });

  it.each([
    ['WEEK', 'esta semana'],
    ['15_DAYS', 'los últimos 15 días'],
    ['MONTH', 'este mes'],
    ['2_MONTHS', 'los últimos 2 meses'],
    ['YEAR', 'este año'],
  ] as const)('etiqueta el rango %s', (rango, etiqueta) => {
    const texto = formatearResumen({
      periodo: {
        mes: null,
        anio: 2026,
        rango,
        fechaInicio: '',
        fechaFin: '',
      },
      totalGeneral: 0,
      porCategoria: [],
    });

    expect(texto).toContain(etiqueta);
    expect(ETIQUETAS_RANGO[rango]).toBe(etiqueta);
  });
});

describe('mensajes de error', () => {
  it('extrae el mensaje de una instancia de Error', () => {
    expect(mensajeDeError(new Error('falló la red'))).toBe('falló la red');
    expect(mensajeErrorGenerico(new Error('falló la red'))).toBe(
      '⚠️ falló la red',
    );
  });

  it('devuelve un mensaje genérico para valores desconocidos', () => {
    expect(mensajeDeError('texto suelto')).toBe('Error inesperado');
    expect(mensajeDeError(null)).toBe('Error inesperado');
  });

  it('prefija el error al guardar un gasto', () => {
    expect(mensajeErrorGuardado('sin conexión')).toContain('sin conexión');
  });
});

describe('mensajes estáticos', () => {
  it('define los textos de confirmación y ayuda', () => {
    expect(MENSAJE_GASTO_GUARDADO).toContain('Gasto registrado');
    expect(MENSAJE_CANCELADO).toContain('cancelado');
    expect(MENSAJE_CUENTA_CREADA).toContain('Cuenta creada');
    expect(MENSAJE_AYUDA).toContain('/resumen');
  });

  it('define los textos de creación de categorías', () => {
    expect(MENSAJE_CATEGORIA_INVALIDA).toContain('2 letras');
    expect(mensajeUsoCategoria()).toContain('/categoria');
    expect(mensajeCategoriaCreada('Gimnasio')).toContain('Gimnasio');
    expect(mensajeErrorCategoria('duplicada')).toContain('duplicada');
  });
});
