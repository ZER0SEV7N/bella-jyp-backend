import { AprobacionMasivaAsistenciaService } from '@/modules/asistencia/services/aprobacion-masiva-asistencia.service';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn((_p, _a, fn) => fn(_p)),
  bloquearEmpleado: jest.fn(),
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
    incidencias_mes: { findMany: jest.fn(), update: jest.fn() },
  };
  const caso = new AprobacionMasivaAsistenciaService(prisma as never);
  beforeEach(() => jest.clearAllMocks());
  it('no aprueba un resumen con asuntos pendientes', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.findMany.mockResolvedValue([
      { empleado_id: 'e', vigente: true, completo: true, pendientes: 1 },
    ]);
    // Act: ejecutar una única operación del componente.
    const r = caso.aprobarLote('2026-09', undefined, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('pendientes');
    expect(prisma.incidencias_mes.update).not.toHaveBeenCalled();
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
