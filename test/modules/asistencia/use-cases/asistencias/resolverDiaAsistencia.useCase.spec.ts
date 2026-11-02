import { ResolverDiaAsistenciaUseCase } from '@/modules/asistencia/use-cases/asistencias/resolverDiaAsistencia.useCase';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn((_p, _a, fn) => fn(_p)),
  bloquearEmpleado: jest.fn(),
}));
jest.mock('@/modules/asistencia/helpers/periodo-editable.helper', () => ({
  validarPeriodoEditable: jest.fn(),
}));
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ResolverDiaAsistenciaUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = {
    empleados: { findUnique: jest.fn() },
    asistencia_decision: { upsert: jest.fn() },
  };
  const caso = new ResolverDiaAsistenciaUseCase(prisma as never);
  it('no crea una decisión para un empleado inexistente', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.empleados.findUnique.mockResolvedValue(null);
    // Act: ejecutar una única operación del componente.
    const r = caso.execute(
      {
        empleado_id: '019a0000-0001-7000-8000-000000000001',
        fecha: '2026-09-01',
        tipo: 'AUSENCIA',
        resultado: 'FALTA_INJUSTIFICADA',
        referencia_evidencia: 'Evidencia demo',
        motivo: 'Revisión ficticia',
      } as never,
      actor
    );
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('colaborador no existe');
    expect(prisma.asistencia_decision.upsert).not.toHaveBeenCalled();
  });
});
