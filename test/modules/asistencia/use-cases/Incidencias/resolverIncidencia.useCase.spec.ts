import { ConflictException } from '@nestjs/common';
import { ResolverIncidenciaUseCase } from '@/modules/asistencia/use-cases/Incidencias/resolverIncidencia.useCase';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn(
    (_p: unknown, _a: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(_p)
  ),
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
    const r = (await caso.execute(dto as never, actor)) as { estado: string };
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r.estado).toBe('RECHAZADO');
    expect(prisma.incidencias_mes.update).toHaveBeenCalledWith({
      where: { id: 'inc', version: 2 },
      data: expect.objectContaining({
        estado: 'RECHAZADO',
        vigente: false,
        aprobado_por: null,
        version: { increment: 1 },
      }) as unknown,
    });
  });
  it('no rechaza una incidencia ya aprobada', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.findUnique.mockResolvedValue({
      estado: 'APROBADO',
      vigente: true,
      completo: true,
      pendientes: 0,
    });
    // Act & Assert: comprobar resultado, efectos y reglas de negocio.
    try {
      await caso.execute(dto as never, actor);
      throw new Error('Debió lanzar ConflictException');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        title: 'Acción no permitida',
        detail: 'Solo se puede rechazar un resumen pendiente.',
      });
    }
    expect(prisma.incidencias_mes.update).not.toHaveBeenCalled();
  });
  it('no reabre una incidencia que ya está pendiente', async () => {
    // Arrange: preparar el escenario en estado PENDIENTE con acción REABRIR.
    prisma.incidencias_mes.findUnique.mockResolvedValue({
      estado: 'PENDIENTE',
      vigente: true,
      completo: true,
      pendientes: 0,
    });
    // Act & Assert: verifica el rechazo de negocio.
    try {
      await caso.execute({ ...dto, accion: 'REABRIR' } as never, actor);
      throw new Error('Debió lanzar ConflictException');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        title: 'Acción no permitida',
        detail: 'El resumen ya está pendiente.',
      });
    }
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
