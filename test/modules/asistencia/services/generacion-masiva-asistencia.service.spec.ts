import { GeneracionMasivaAsistenciaService } from '@/modules/asistencia/services/generacion-masiva-asistencia.service';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('GeneracionMasivaAsistenciaService', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = { empleados: { findMany: jest.fn() } },
    generar = { execute: jest.fn() };
  const caso = new GeneracionMasivaAsistenciaService(
    prisma as never,
    generar as never
  );
  it('informa errores por empleado y continúa el lote', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.empleados.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    generar.execute
      .mockResolvedValueOnce({ id: 'i', estado: 'PENDIENTE' })
      .mockRejectedValueOnce(new Error('Sin jornada'));
    // Act: ejecutar una única operación del componente.
    const r = await caso.generar({ periodo: '2026-09', limite: 30 }, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r.total_procesados).toBe(1);
    expect(r.errores).toBe(1);
    expect(r.detalle[1].error).toBe('Sin jornada');
  });
  it('propaga el error al solicitar un único empleado', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.empleados.findMany.mockResolvedValue([{ id: 'a' }]);
    generar.execute.mockRejectedValue(new Error('Sin jornada'));
    // Act: ejecutar una única operación del componente.
    const r = caso.generar(
      { periodo: '2026-09', limite: 30, empleado_id: 'a' },
      actor
    );
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('Sin jornada');
  });
});
