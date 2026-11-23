//test/modules/RRHH/dashboard/helpers/dashboard-dotacion.helper.spec.ts
import {
  calcularRotacionPorcentaje,
  construirDistribucionAreas,
} from '@/modules/RRHH/dashboard/helpers/dashboard-dotacion.helper';

describe('dashboard-dotacion.helper', () => {
  it('retorna 0 cuando el promedio de activos es 0', () => {
    expect(calcularRotacionPorcentaje(3, 0, 0)).toBe(0);
  });

  it('calcula rotación redondeada a 2 decimales', () => {
    // 2 / ((10 + 14) / 2) * 100 = 16.67
    expect(calcularRotacionPorcentaje(2, 10, 14)).toBe(16.67);
  });

  it('ordena áreas descendente por total y excluye vacías', () => {
    const areas = construirDistribucionAreas(
      [
        { area_id: 'a1', nombre: 'Finanzas', total_empleados: 2 },
        { area_id: 'a2', nombre: 'Operaciones', total_empleados: 5 },
        { area_id: 'a3', nombre: 'Vacía', total_empleados: 0 },
      ],
      7
    );

    expect(areas).toEqual([
      {
        area_id: 'a2',
        nombre: 'Operaciones',
        total_empleados: 5,
        porcentaje: 71.43,
      },
      {
        area_id: 'a1',
        nombre: 'Finanzas',
        total_empleados: 2,
        porcentaje: 28.57,
      },
    ]);
  });
});
