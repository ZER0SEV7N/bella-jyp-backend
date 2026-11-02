import { GuardarDescansoAsistenciaUseCase } from '@/modules/asistencia/use-cases/asistencias/guardarDescansoAsistencia.useCase';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn((_p, _a, fn) => fn(_p)),
  bloquearEmpleado: jest.fn(),
}));
jest.mock('@/modules/asistencia/helpers/periodo-editable.helper', () => ({
  validarPeriodoEditable: jest.fn(),
}));
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('GuardarDescansoAsistenciaUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = { asistencia_calendario: { upsert: jest.fn() } };
  const caso = new GuardarDescansoAsistenciaUseCase(prisma as never);
  it('guarda la fecha civil y el responsable', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.asistencia_calendario.upsert.mockResolvedValue({ id: 'dia' });
    // Act: ejecutar una única operación del componente.
    await caso.execute(
      {
        fecha: '2026-09-10',
        nombre: 'Descanso local',
        motivo: 'Prueba ficticia',
        activo: true,
      },
      actor
    );
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(prisma.asistencia_calendario.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fecha: new Date('2026-09-10T00:00:00Z') },
        create: expect.objectContaining({
          usuario_id: actor.id,
          activo: true,
        }),
      })
    );
  });
});
