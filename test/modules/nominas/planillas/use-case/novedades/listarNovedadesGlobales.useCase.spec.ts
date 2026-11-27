//test/modules/nominas/planillas/use-case/novedades/listarNovedadesGlobales.useCase.spec.ts
import { ListarNovedadesGlobalesUseCase } from '@/modules/nomina/planillas/use-case/novedades/listarNovedadesGlobales.useCase';

/**
 * Pruebas unitarias del listado global de novedades (PLA-F5).
 */
describe('ListarNovedadesGlobalesUseCase', () => {
  const prisma = {
    novedad_planilla: { count: jest.fn(), findMany: jest.fn() },
  };
  const useCase = new ListarNovedadesGlobalesUseCase(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('Debe paginar y mapear el colaborador de cada novedad', async () => {
    // Arrange
    prisma.novedad_planilla.count.mockResolvedValue(1);
    prisma.novedad_planilla.findMany.mockResolvedValue([
      {
        id: 'novedad-1',
        empleado_id: 'empleado-1',
        periodo: '2026-11',
        tipo: 'DESCUENTO_AUTORIZADO',
        monto: { toString: () => '50.0000' },
        estado: 'PENDIENTE',
        motivo: 'Descuento autorizado',
        created_at: new Date('2026-11-05T00:00:00Z'),
        empleado: { nombre: 'Ana', apellido: 'Lopez' },
      },
    ]);

    // Act
    const resultado = await useCase.execute({ page: 1, limit: 20 });

    // Assert
    expect(prisma.novedad_planilla.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      })
    );
    expect(resultado.data[0]).toEqual(
      expect.objectContaining({
        id: 'novedad-1',
        colaborador: 'Ana Lopez',
        estado: 'PENDIENTE',
      })
    );
    expect(resultado.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('Debe aplicar los filtros de empleado, periodo y estado al where', async () => {
    // Arrange
    prisma.novedad_planilla.count.mockResolvedValue(0);
    prisma.novedad_planilla.findMany.mockResolvedValue([]);

    // Act
    await useCase.execute({
      empleado_id: 'empleado-1',
      periodo: '2026-11',
      estado: 'APROBADO',
    });

    // Assert
    expect(prisma.novedad_planilla.count).toHaveBeenCalledWith({
      where: {
        empleado_id: 'empleado-1',
        periodo: '2026-11',
        estado: 'APROBADO',
      },
    });
  });
});
