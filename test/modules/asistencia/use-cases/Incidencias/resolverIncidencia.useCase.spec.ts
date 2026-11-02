import { ResolverIncidenciaUseCase } from '@/modules/asistencia/use-cases/Incidencias/resolverIncidencia.useCase';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn((_p, _a, fn) => fn(_p)),
  bloquearEmpleado: jest.fn(),
}));
jest.mock('@/modules/asistencia/helpers/periodo-editable.helper', () => ({
  validarPeriodoEditable: jest.fn(),
}));
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ResolverIncidenciaUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = {
    incidencias_mes: { findUnique: jest.fn(), update: jest.fn() },
  };
  const caso = new ResolverIncidenciaUseCase(prisma as never);
  const dto = {
    empleado_id: 'empleado',
    periodo: '2026-09',
    accion: 'RECHAZAR',
    motivo: 'Revisión documentada',
  };
  beforeEach(() => jest.clearAllMocks());
  it('rechaza una incidencia pendiente sin mantener aprobación', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.findUnique.mockResolvedValue({
      id: 'inc',
      estado: 'PENDIENTE',
      version: 2,
    });
    prisma.incidencias_mes.update.mockResolvedValue({
      estado: 'RECHAZADO',
    });
    // Act: ejecutar una única operación del componente.
    const r = await caso.execute(dto as never, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r.estado).toBe('RECHAZADO');
    expect(prisma.incidencias_mes.update).toHaveBeenCalledWith({
      where: { id: 'inc', version: 2 },
      data: expect.objectContaining({
        estado: 'RECHAZADO',
        vigente: false,
        aprobado_por: null,
        version: { increment: 1 },
      }),
    });
  });
  it('no rechaza una incidencia ya aprobada', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.findUnique.mockResolvedValue({
      estado: 'APROBADO',
    });
    // Act: ejecutar una única operación del componente.
    const r = caso.execute(dto as never, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('pendiente');
    expect(prisma.incidencias_mes.update).not.toHaveBeenCalled();
  });
  it('informa una incidencia inexistente', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.findUnique.mockResolvedValue(null);
    // Act: ejecutar una única operación del componente.
    const r = caso.execute(dto as never, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('no existe');
  });
});
