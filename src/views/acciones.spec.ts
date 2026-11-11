import { describe, expect, it } from 'vitest';
import {
  construirTecladoCampos,
  construirTecladoCancelar,
  construirTecladoConfirmarEliminar,
  construirTecladoLista,
  construirTecladoPaginacion,
  construirTextoCampoElegido,
  construirTextoDetalleEliminar,
  construirTextoDetalleModificar,
  construirTextoLista,
  formatearFechaAccion,
  formatearMontoAccion,
  mensajeActualizado,
  mensajeEliminado,
  mensajeValorInvalido,
  type GastoAccion,
} from './acciones.js';

const GASTOS: GastoAccion[] = [
  {
    id: 101,
    monto: '5000',
    descripcion: 'Gimnasio',
    fecha: '2026-11-06T16:04:19.305Z',
    categoria: { nombre: 'Salud y Bienestar' },
  },
  {
    id: 100,
    monto: 3767,
    descripcion: 'Compra <semanal> & más',
    fecha: '2026-11-05T12:00:00.000Z',
    categoria: null,
  },
];

describe('formatearMontoAccion', () => {
  it('acepta números y strings del JSON de la API', () => {
    expect(formatearMontoAccion(5000)).toBe('$5.000');
    expect(formatearMontoAccion('3767')).toBe('$3.767');
    expect(formatearMontoAccion(0)).toBe('$0');
  });

  it('no rompe con valores no numéricos', () => {
    expect(formatearMontoAccion('no-es-un-monto')).toBe('$0');
  });
});

describe('formatearFechaAccion', () => {
  it('convierte ISO con hora a DD/MM/YYYY', () => {
    expect(formatearFechaAccion('2026-11-06T16:04:19.305Z')).toBe('06/11/2026');
  });

  it('muestra un texto claro cuando no hay fecha', () => {
    expect(formatearFechaAccion(null)).toBe('sin fecha');
    expect(formatearFechaAccion(undefined)).toBe('sin fecha');
  });
});

describe('construirTextoLista', () => {
  it('lista los gastos con id, monto, fecha y descripción escapada', () => {
    const texto = construirTextoLista(GASTOS, 'eliminar');

    expect(texto).toContain('¿Qué gasto querés eliminar?');
    expect(texto).toContain('#101');
    expect(texto).toContain('$5.000');
    expect(texto).toContain('06/11/2026');
    expect(texto).toContain('Compra &lt;semanal&gt; &amp; más');
  });

  it('cambia el título según la acción', () => {
    expect(construirTextoLista(GASTOS, 'modificar')).toContain(
      '¿Qué gasto querés modificar?',
    );
  });
});

describe('construirTecladoLista', () => {
  it('crea un botón por gasto y uno de cancelar', () => {
    const teclado = construirTecladoLista(GASTOS, 'eliminar');

    expect(teclado).toHaveLength(3);
    expect(teclado[0]?.[0]?.callback_data).toBe('del:101');
    expect(teclado[1]?.[0]?.callback_data).toBe('del:100');
    expect(teclado[2]?.[0]).toEqual({
      text: '🚫 Cancelar y volver',
      callback_data: 'delno',
    });
    expect(teclado[0]?.[0]?.text).toContain('#101');
  });

  it('usa los prefijos de modificación', () => {
    const teclado = construirTecladoLista(GASTOS, 'modificar');

    expect(teclado[0]?.[0]?.callback_data).toBe('edit:101');
    expect(teclado[2]?.[0]?.callback_data).toBe('editno');
  });
});

describe('pantallas de detalle', () => {
  it('muestra el detalle de eliminación con categoría y monto', () => {
    const texto = construirTextoDetalleEliminar(GASTOS[0]!);

    expect(texto).toContain('no se puede deshacer');
    expect(texto).toContain('#101');
    expect(texto).toContain('$5.000');
    expect(texto).toContain('Salud y Bienestar');
    expect(texto).toContain('¿Confirmás que lo elimino?');
  });

  it('usa "Sin categoría" cuando falta la categoría', () => {
    expect(construirTextoDetalleEliminar(GASTOS[1]!)).toContain(
      'Sin categoría',
    );
  });

  it('muestra el detalle de modificación', () => {
    const texto = construirTextoDetalleModificar(GASTOS[0]!);

    expect(texto).toContain('Modificar gasto');
    expect(texto).toContain('¿Qué querés cambiar?');
  });
});

describe('teclados de acciones', () => {
  it('arma los botones de confirmación de borrado', () => {
    expect(construirTecladoConfirmarEliminar(101)).toEqual([
      [
        { text: '🗑️ Sí, eliminar', callback_data: 'delok:101' },
        { text: '↩️ No', callback_data: 'delno' },
      ],
    ]);
  });

  it('arma los botones de campos editables', () => {
    const teclado = construirTecladoCampos(101);
    const callbacks = teclado.flat().map((boton) => boton.callback_data);

    expect(callbacks).toEqual([
      'editf:101:monto',
      'editf:101:comercio',
      'editf:101:categoria',
      'editf:101:fecha',
      'editno',
    ]);
  });

  it('arma un teclado de cancelación simple', () => {
    expect(construirTecladoCancelar()).toEqual([
      [{ text: '🚫 Cancelar', callback_data: 'editno' }],
    ]);
  });
});

describe('teclado de paginación', () => {
  it('incluye la acción en el callback para saber a qué lista pertenece', () => {
    const eliminar = construirTecladoPaginacion(1, 3, 'eliminar')
      .flat()
      .map((boton) => boton.callback_data);
    const modificar = construirTecladoPaginacion(1, 3, 'modificar')
      .flat()
      .map((boton) => boton.callback_data);

    expect(eliminar).toEqual([
      'pagina:eliminar:noop',
      'pagina:eliminar:2',
    ]);
    expect(modificar).toEqual([
      'pagina:modificar:noop',
      'pagina:modificar:2',
    ]);
  });

  it('ofrece anterior y siguiente según la página actual', () => {
    const callbacks = construirTecladoPaginacion(2, 3, 'eliminar')
      .flat()
      .map((boton) => boton.callback_data);

    expect(callbacks).toEqual([
      'pagina:eliminar:1',
      'pagina:eliminar:noop',
      'pagina:eliminar:3',
    ]);
  });

  it('no muestra botones cuando hay una sola página', () => {
    expect(construirTecladoPaginacion(1, 1, 'eliminar')).toEqual([]);
  });
});

describe('construirTextoCampoElegido', () => {
  it('explica cómo enviar cada campo', () => {
    expect(construirTextoCampoElegido(GASTOS[0]!, 'monto')).toContain(
      'Enviame el nuevo monto',
    );
    expect(construirTextoCampoElegido(GASTOS[0]!, 'comercio')).toContain(
      'Enviame el nuevo comercio',
    );
    expect(construirTextoCampoElegido(GASTOS[0]!, 'categoria')).toContain(
      'categoría existente',
    );
    expect(construirTextoCampoElegido(GASTOS[0]!, 'fecha')).toContain(
      'Enviame la nueva fecha',
    );
  });
});

describe('mensajes de resultado', () => {
  it('confirma la eliminación con id y monto', () => {
    const texto = mensajeEliminado(GASTOS[0]!);

    expect(texto).toContain('Gasto eliminado');
    expect(texto).toContain('#101');
    expect(texto).toContain('$5.000');
  });

  it('muestra el gasto actualizado', () => {
    const texto = mensajeActualizado(GASTOS[0]!);

    expect(texto).toContain('actualizado');
    expect(texto).toContain('#101');
    expect(texto).toContain('Salud y Bienestar');
  });

  it('explica qué valor se esperaba para cada campo', () => {
    expect(mensajeValorInvalido('monto')).toContain('monto válido');
    expect(mensajeValorInvalido('comercio')).toContain('comercio');
    expect(mensajeValorInvalido('categoria')).toContain('categoría existente');
    expect(mensajeValorInvalido('fecha')).toContain('fecha válida');
  });
});
