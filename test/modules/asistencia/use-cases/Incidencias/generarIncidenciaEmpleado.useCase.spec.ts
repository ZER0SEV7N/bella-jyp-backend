import { GenerarIncidenciaEmpleadoUseCase } from '@/modules/asistencia/use-cases/Incidencias/generarIncidenciaEmpleado.useCase';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn((_p, _a, fn) => fn(_p)),
  bloquearEmpleado: jest.fn(),
}));
jest.mock('@/modules/asistencia/helpers/periodo-editable.helper', () => ({
  validarPeriodoEditable: jest.fn(),
}));
import { contexto } from '../../../../fixtures/motores.fixture';
import {
  cargarContextoAsistencia,
  huellaAsistencia,
} from '@/modules/asistencia/helpers/asistencia-contexto.helper';
jest.mock('@/modules/asistencia/helpers/asistencia-contexto.helper');
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('GenerarIncidenciaEmpleadoUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = { incidencias_mes: { upsert: jest.fn() } };
  const caso = new GenerarIncidenciaEmpleadoUseCase(prisma as never);
  it('calcula el resumen real y mantiene el estado pendiente de aprobación', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    jest
      .mocked(cargarContextoAsistencia)
      .mockResolvedValue(contexto() as never);
    jest.mocked(huellaAsistencia).mockReturnValue('hash');
    prisma.incidencias_mes.upsert.mockResolvedValue({ id: 'resumen' });
    // Act: ejecutar una única operación del componente.
    const r = await caso.execute('empleado', '2026-09', actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r.id).toBe('resumen');
    expect(prisma.incidencias_mes.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          empleado_id: 'empleado',
          estado: 'PENDIENTE',
          aprobado_por: null,
          fuente_hash: 'hash',
          vigente: true,
        }),
      })
    );
  });
});
