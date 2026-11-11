import { describe, expect, it } from 'vitest';
import {
  construirConfigGrafico,
  construirTituloGrafico,
  construirUrlGrafico,
  consolidarCategorias,
  describirPeriodoGrafico,
  formatearMontoGrafico,
  TOP_N,
  type ResumenGrafico,
} from './grafico.service.js';

const resumen: ResumenGrafico = {
  periodo: { rango: 'MONTH', mes: 10, anio: 2026 },
  totalGeneral: 1500,
  porCategoria: [
    { categoriaNombre: 'Alimentación', total: 1000, porcentaje: 66.6 },
    { categoriaNombre: 'Transporte', total: 500, porcentaje: 33.4 },
  ],
};

describe('formatearMontoGrafico', () => {
  it('usa separador de miles sin decimales', () => {
    expect(formatearMontoGrafico(1500)).toBe('$1.500');
    expect(formatearMontoGrafico(9876543)).toBe('$9.876.543');
    expect(formatearMontoGrafico(0)).toBe('$0');
  });
});

describe('construirTituloGrafico', () => {
  it('incluir el período y el total en el título', () => {
    const titulo = construirTituloGrafico(resumen, 'MONTH');
    expect(titulo).toContain('octubre');
    expect(titulo).toContain('2026');
    expect(titulo).toContain('$1.500');
  });

  it('usa el año cuando el rango es YEAR', () => {
    const titulo = construirTituloGrafico(
      { ...resumen, periodo: { rango: null, mes: null, anio: 2026 } },
      'YEAR',
    );
    expect(titulo).toContain('de 2026');
    expect(titulo).toContain('$1.500');
  });

  it('menciona el período sin año para rangos cortos', () => {
    const titulo = construirTituloGrafico(
      { ...resumen, periodo: { rango: null, mes: null, anio: 2026 } },
      'WEEK',
    );
    expect(titulo).toContain('semana');
    expect(titulo).toContain('$1.500');
  });

  it('usa las fechas cuando el período es un rango personalizado', () => {
    const titulo = construirTituloGrafico(
      { ...resumen, periodo: { rango: null, mes: null, anio: 2026 } },
      { desde: '2026-01-01', hasta: '2026-11-06' },
    );
    expect(titulo).toContain('01/01/2026');
    expect(titulo).toContain('06/11/2026');
    expect(titulo).toContain('$1.500');
  });
});

describe('describirPeriodoGrafico', () => {
  it('describe los rangos predefinidos', () => {
    expect(describirPeriodoGrafico('TODAY')).toBe('hoy');
    expect(describirPeriodoGrafico('WEEK')).toBe('esta semana');
    expect(describirPeriodoGrafico('MONTH')).toBe('este mes');
    expect(describirPeriodoGrafico('YEAR')).toBe('este año');
  });

  it('describe un rango de fechas', () => {
    expect(
      describirPeriodoGrafico({ desde: '2026-01-01', hasta: '2026-11-06' }),
    ).toBe('del 01/01/2026 al 06/11/2026');
  });
});

describe('consolidarCategorias', () => {
  function muchas(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      categoriaNombre: `Cat ${i + 1}`,
      total: 100 - i,
      porcentaje: 10 - i,
    }));
  }

  it('deja pasar la lista cuando hay pocas categorías', () => {
    const resultado = consolidarCategorias(resumen.porCategoria);
    expect(resultado).toHaveLength(2);
    expect(resultado[0]!.categoriaNombre).toBe('Alimentación');
  });

  it('ordena de mayor a menor', () => {
    const resultado = consolidarCategorias([...resumen.porCategoria].reverse());
    expect(resultado[0]!.categoriaNombre).toBe('Alimentación');
  });

  it('agrupa las categorías de baja participación en Otros', () => {
    const resultado = consolidarCategorias(muchas(13));
    expect(resultado).toHaveLength(TOP_N + 1);
    expect(resultado[resultado.length - 1]!.categoriaNombre).toBe('Otros');
    const esperadoOtros = muchas(13)
      .slice(TOP_N)
      .reduce((acc, c) => acc + c.total, 0);
    expect(resultado[resultado.length - 1]!.total).toBe(esperadoOtros);
  });

  it('ignora categorías con total cero', () => {
    const resultado = consolidarCategorias([
      { categoriaNombre: 'Vacía', total: 0, porcentaje: 0 },
      ...resumen.porCategoria,
    ]);
    expect(resultado.map((c) => c.categoriaNombre)).not.toContain('Vacía');
  });
});

describe('construirConfigGrafico', () => {
  it('usa barras horizontales con Chart.js v4', () => {
    const config = construirConfigGrafico(resumen, 'MONTH') as {
      type: string;
      options: { indexAxis: string };
    };
    expect(config.type).toBe('bar');
    expect(config.options.indexAxis).toBe('y');
  });

  it('incluye monto y porcentaje en las etiquetas', () => {
    const config = construirConfigGrafico(resumen, 'MONTH') as {
      data: { labels: string[]; datasets: Array<{ data: number[] }> };
    };
    expect(config.data.labels).toHaveLength(2);
    expect(config.data.labels[0]).toContain('Transporte');
    expect(config.data.labels[0]).toContain('$500');
    expect(config.data.labels[0]).toContain('33.4%');
    expect(config.data.labels[1]).toContain('Alimentación');
    expect(config.data.labels[1]).toContain('$1.000');
    expect(config.data.labels[1]).toContain('66.6%');
    expect(config.data.datasets[0]!.data).toEqual([500, 1000]);
  });

  it('pone la categoría mayor arriba', () => {
    const config = construirConfigGrafico(resumen, 'MONTH') as {
      data: { labels: string[] };
    };
    expect(config.data.labels[1]).toContain('Alimentación');
  });

  it('agrupa en Otros cuando hay muchas categorías', () => {
    const muchas = Array.from({ length: 13 }, (_, i) => ({
      categoriaNombre: `Cat ${i + 1}`,
      total: 100 - i,
      porcentaje: 8,
    }));
    const config = construirConfigGrafico(
      { ...resumen, porCategoria: muchas },
      'MONTH',
    ) as { data: { labels: string[] } };
    expect(config.data.labels).toHaveLength(TOP_N + 1);
    expect(config.data.labels[0]).toContain('Otros');
  });

  it('el título es el del período y el total', () => {
    const config = construirConfigGrafico(resumen, 'MONTH') as {
      options: { plugins: { title: { text: string } } };
    };
    expect(config.options.plugins.title.text).toContain('$1.500');
  });
});

describe('construirUrlGrafico', () => {
  it('genera una URL de QuickChart con Chart.js v4 y tamaño 900x600', () => {
    const url = construirUrlGrafico(resumen, 'MONTH');
    expect(url.startsWith('https://quickchart.io/chart?c=')).toBe(true);
    expect(url).toContain('v=4');
    expect(url).toContain('w=900');
    expect(url).toContain('h=600');
    const config = JSON.parse(decodeURIComponent(url.split('c=')[1]!.split('&')[0]!));
    expect(config.type).toBe('bar');
    expect(config.options.indexAxis).toBe('y');
  });

  it('por defecto usa mes', () => {
    const config = construirConfigGrafico(resumen, 'MONTH') as {
      options: { plugins: { title: { text: string } } };
    };
    expect(config.options.plugins.title.text).toContain('octubre');
  });
});
