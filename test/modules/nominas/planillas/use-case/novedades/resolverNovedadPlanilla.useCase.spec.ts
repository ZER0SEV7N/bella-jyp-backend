import { ResolverNovedadPlanillaUseCase } from '@/modules/nomina/planillas/use-case/novedades/resolverNovedadPlanilla.useCase';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn((p, _a, fn) => fn(p)),
  bloquearEmpleado: jest.fn(),
}));
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ResolverNovedadPlanillaUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = {
    novedad_planilla: { findUnique: jest.fn(), update: jest.fn() },
    //Sin planilla previa para el período: la resolución no se bloquea por estado (PLA-F7).
    historial_planillas: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const caso = new ResolverNovedadPlanillaUseCase(prisma as never);
  beforeEach(() => jest.clearAllMocks());
  it('no aprueba una versión obsoleta', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.novedad_planilla.findUnique.mockResolvedValue({
      empleado_id: 'e',
      periodo: '2026-09',
      estado: 'PENDIENTE',
      version: 2,
    });
    // Act: ejecutar una única operación del componente.
    const r = caso.execute(
      'n',
      { version: 1, estado: 'APROBADO', motivo: 'Revisión ficticia' },
      actor
    );
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('versión');
    expect(prisma.novedad_planilla.update).not.toHaveBeenCalled();
  });
  it('permite anular una novedad aprobada dejando su responsable', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.novedad_planilla.findUnique.mockResolvedValue({
      empleado_id: 'e',
      periodo: '2026-09',
      estado: 'APROBADO',
      version: 2,
    });
    // Act: ejecutar una única operación del componente.
    await caso.execute(
      'n',
      { version: 2, estado: 'ANULADO', motivo: 'Anulación documentada' },
      actor
    );
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(prisma.novedad_planilla.update).toHaveBeenCalledWith({
      where: { id: 'n', estado: 'APROBADO', version: 2 },
      data: expect.objectContaining({
        estado: 'ANULADO',
        resuelto_por: actor.id,
        version: { increment: 1 },
      }),
    });
  });
});
