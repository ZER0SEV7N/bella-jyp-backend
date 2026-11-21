import { ConflictException } from '@nestjs/common';
import { AprobacionMasivaAsistenciaService } from '@/modules/asistencia/services/aprobacion-masiva-asistencia.service';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn(
    (_p: unknown, _a: unknown, fn: (tx: unknown) => unknown) => fn(_p)
  ),
  bloquearEmpleado: jest.fn(),
  bloquearPeriodo: jest.requireActual<
    typeof import('@/common/utils/transaccion-auditada.util')
  >('@/common/utils/transaccion-auditada.util').bloquearPeriodo,
}));
jest.mock('@/modules/asistencia/helpers/periodo-editable.helper', () => ({
  validarPeriodoEditable: jest.fn(),
}));
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('AprobacionMasivaAsistenciaService', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = {
    $executeRaw: jest.fn(),
    incidencias_mes: { findMany: jest.fn(), update: jest.fn() },
  };
  const caso = new AprobacionMasivaAsistenciaService(prisma as never);
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$executeRaw.mockResolvedValue(1);
  });
  it('no aprueba un resumen con asuntos pendientes e identifica al colaborador en lote', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.findMany.mockResolvedValue([
      {
        empleado_id: 'e',
        estado: 'PENDIENTE',
        vigente: true,
        completo: true,
        pendientes: 1,
      },
    ]);
    // Act & Assert: comprobar resultado, efectos y reglas de negocio.
    try {
      await caso.aprobarLote('2026-09', undefined, actor);
      throw new Error('Debió lanzar ConflictException');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        title: 'Acción no permitida',
        detail: 'El colaborador e: Hay 1 día por resolver antes de aprobar.',
      });
    }
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.incidencias_mes.update).not.toHaveBeenCalled();
  });
  it('mantiene el motivo directo cuando se aprueba un colaborador específico', async () => {
    // Arrange: aprobar por empleado puntual no debe prefijar el identificador.
    prisma.incidencias_mes.findMany.mockResolvedValue([
      {
        empleado_id: 'e',
        estado: 'PENDIENTE',
        vigente: false,
        completo: true,
        pendientes: 0,
      },
    ]);
    // Act & Assert: verifica el mensaje directo del helper.
    try {
      await caso.aprobarLote('2026-09', 'e', actor);
      throw new Error('Debió lanzar ConflictException');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        title: 'Acción no permitida',
        detail:
          'El resumen está desactualizado: actualízalo para poder aprobarlo.',
      });
    }
  });
  it('rechaza lotes de más de cien resúmenes', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.findMany.mockResolvedValue(
      Array.from({ length: 101 }, () => ({}))
    );
    // Act: ejecutar una única operación del componente.
    const r = caso.aprobarLote('2026-09', undefined, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('cien');
    expect(prisma.incidencias_mes.update).not.toHaveBeenCalled();
  });
});
