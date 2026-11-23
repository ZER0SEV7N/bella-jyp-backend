import { ConflictException } from '@nestjs/common';
import {
  listarPeriodosCerrados,
  validarFechaSinPeriodoCerrado,
  validarJornadaSinPeriodosCerrados,
} from '@/modules/asistencia/helpers/periodo-editable.helper';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('periodo-editable.helper', () => {
  const crearTx = () => ({
    incidencias_mes: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    historial_planillas: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  });

  it('listarPeriodosCerrados combina incidencias aprobadas y planillas no abiertas sin duplicados y ordenados', async () => {
    // Arrange: dos meses cerrados por incidencias aprobadas y otro por planilla cerrada, con uno repetido.
    const tx = crearTx();
    tx.incidencias_mes.findMany.mockResolvedValue([
      { periodo: '2026-03' },
      { periodo: '2026-01' },
    ]);
    tx.historial_planillas.findMany.mockResolvedValue([
      { periodo: '2026-03' },
      { periodo: '2026-02' },
    ]);

    // Act: consultar períodos cerrados del año.
    const cerrados = await listarPeriodosCerrados(tx as never, [
      '2026-01',
      '2026-02',
      '2026-03',
    ]);

    // Assert: devuelve lista única ordenada y sin consultar con arreglo vacío.
    expect(cerrados).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(tx.incidencias_mes.findMany).toHaveBeenCalledWith({
      where: {
        periodo: { in: ['2026-01', '2026-02', '2026-03'] },
        estado: 'APROBADO',
      },
      select: { periodo: true },
      distinct: ['periodo'],
    });
    expect(tx.historial_planillas.findMany).toHaveBeenCalledWith({
      where: {
        periodo: { in: ['2026-01', '2026-02', '2026-03'] },
        estado: { not: 'ABIERTO' },
      },
      select: { periodo: true },
      distinct: ['periodo'],
    });
    await expect(listarPeriodosCerrados(tx as never, [])).resolves.toEqual([]);
  });

  it('validarFechaSinPeriodoCerrado lanza ConflictException con detalle cuando hay aprobados o planilla cerrada', async () => {
    // Arrange: período con 3 colaboradores aprobados.
    const tx = crearTx();
    tx.incidencias_mes.count.mockResolvedValue(3);
    tx.historial_planillas.findFirst.mockResolvedValue(null);

    // Act & Assert: rechaza con título y detalle esperados.
    await expect(
      validarFechaSinPeriodoCerrado(tx as never, '2026-07-23')
    ).rejects.toThrow(ConflictException);

    try {
      await validarFechaSinPeriodoCerrado(tx as never, '2026-07-23');
    } catch (error) {
      expect((error as ConflictException).getResponse()).toEqual({
        title: 'Periodo cerrado',
        detail:
          'El periodo 2026-07 tiene resúmenes aprobados (3 colaboradores aprobados) o una planilla cerrada. Reabra el periodo antes de modificar el calendario.',
      });
    }
  });

  it('validarJornadaSinPeriodosCerrados rechaza si existe período cerrado igual o posterior a desde', async () => {
    // Arrange: sin incidencias aprobadas, pero con planilla cerrada en un mes posterior.
    const tx = crearTx();
    tx.incidencias_mes.findFirst.mockResolvedValue(null);
    tx.historial_planillas.findFirst.mockResolvedValue({ periodo: '2026-11' });

    // Act & Assert: rechaza el cambio de jornada.
    await expect(
      validarJornadaSinPeriodosCerrados(tx as never, 'emp-1', '2026-09-15')
    ).rejects.toThrow(ConflictException);
  });
});
