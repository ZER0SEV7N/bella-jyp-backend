//test/modules/nominas/planillas/use-case/desembolso/listarAdelantosPendientesDesembolso.useCase.spec.ts
import { ListarAdelantosPendientesDesembolsoUseCase } from '@/modules/nomina/planillas/use-case/desembolso/listarAdelantosPendientesDesembolso.useCase';

/**
 * Pruebas unitarias de la consulta de adelantos aprobados pendientes de desembolso (PLA-F9).
 */
describe('ListarAdelantosPendientesDesembolsoUseCase', () => {
  const prisma = { solicitud: { findMany: jest.fn() } };
  const useCase = new ListarAdelantosPendientesDesembolsoUseCase(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('Debe consultar solo adelantos APROBADA sin desembolso y mapear el colaborador', async () => {
    // Arrange
    prisma.solicitud.findMany.mockResolvedValue([
      {
        id: 'solicitud-1',
        codigo: 'AD-001',
        empleado_id: 'empleado-1',
        monto: { toString: () => '500.0000' },
        fecha_limite: null,
        created_at: new Date('2026-11-01T00:00:00Z'),
        empleados: {
          nombre: 'Carlos',
          apellido: 'Mendoza',
          nro_documento: '72345678',
        },
      },
    ]);

    // Act
    const resultado = await useCase.execute();

    // Assert: filtro de pendientes + mapeo legible del colaborador.
    expect(prisma.solicitud.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tipo: 'ADELANTO_SUELDO',
          estado: 'APROBADA',
          deleted_at: null,
          desembolso: { is: null },
        },
        orderBy: { created_at: 'desc' },
      })
    );
    expect(resultado).toEqual([
      expect.objectContaining({
        id: 'solicitud-1',
        codigo: 'AD-001',
        colaborador: 'Carlos Mendoza',
        nro_documento: '72345678',
      }),
    ]);
  });

  it('Debe devolver una lista vacía cuando no hay adelantos pendientes', async () => {
    // Arrange
    prisma.solicitud.findMany.mockResolvedValue([]);

    // Act
    const resultado = await useCase.execute();

    // Assert
    expect(resultado).toEqual([]);
  });
});
