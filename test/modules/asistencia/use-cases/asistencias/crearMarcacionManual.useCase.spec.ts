import { CrearMarcacionManualUseCase } from '@/modules/asistencia/use-cases/asistencias/crearMarcacionManual.useCase';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn((_p, _a, fn) => fn(_p)),
  bloquearEmpleado: jest.fn(),
}));
jest.mock('@/modules/asistencia/helpers/periodo-editable.helper', () => ({
  validarPeriodoEditable: jest.fn(),
}));
import {
  obtenerColaborador,
  validarExistencia,
} from '@/modules/asistencia/helpers/procesarAsistenciaWeb.helper';
jest.mock('@/modules/asistencia/helpers/procesarAsistenciaWeb.helper');
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('CrearMarcacionManualUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = { asistencia_marcacion: { create: jest.fn() } };
  const caso = new CrearMarcacionManualUseCase(prisma as never);
  beforeEach(() => jest.clearAllMocks());
  it('rechaza una marcación duplicada sin insertar', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    jest.mocked(obtenerColaborador).mockResolvedValue({ id: 'e' } as never);
    jest.mocked(validarExistencia).mockResolvedValue({
      id: 'existente',
    } as never);
    // Act: ejecutar una única operación del componente.
    const r = caso.execute(
      {
        nro_documento: '09900001',
        fecha_hora: new Date('2026-09-01T14:00:00Z'),
        tipo_marcacion: 'ENTRADA',
        motivo: 'Prueba documentada',
      },
      actor
    );
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow();
    expect(prisma.asistencia_marcacion.create).not.toHaveBeenCalled();
  });
  it('registra el responsable de la marcación manual', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    jest.mocked(obtenerColaborador).mockResolvedValue({ id: 'e' } as never);
    jest.mocked(validarExistencia).mockResolvedValue(null);
    prisma.asistencia_marcacion.create.mockResolvedValue({ id: 'nueva' });
    // Act: ejecutar una única operación del componente.
    await caso.execute(
      {
        nro_documento: '09900001',
        fecha_hora: new Date('2026-09-01T14:00:00Z'),
        tipo_marcacion: 'ENTRADA',
        motivo: 'Regularización de prueba',
      },
      actor
    );
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(prisma.asistencia_marcacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        empleado_id: 'e',
        metodo: 'MANUAL',
        usuario_id: actor.id,
      }),
    });
  });
});
