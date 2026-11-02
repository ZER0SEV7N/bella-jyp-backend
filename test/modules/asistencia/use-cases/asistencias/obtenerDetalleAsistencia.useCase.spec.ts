import { ObtenerDetalleAsistenciaUseCase } from '@/modules/asistencia/use-cases/asistencias/obtenerDetalleAsistencia.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ObtenerDetalleAsistenciaUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = { incidencias_mes: { findUnique: jest.fn() } };
  const caso = new ObtenerDetalleAsistenciaUseCase(prisma as never);
  it('devuelve el resumen solicitado', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.findUnique.mockResolvedValue({ id: 'resumen' });
    // Act: ejecutar una única operación del componente.
    const r = await caso.execute('empleado', '2026-09');
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r).toEqual({ id: 'resumen' });
    expect(prisma.incidencias_mes.findUnique).toHaveBeenCalledWith({
      where: {
        empleado_id_periodo: {
          empleado_id: 'empleado',
          periodo: '2026-09',
        },
      },
    });
  });
  it('rechaza cuando aún no se generó el resumen', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.findUnique.mockResolvedValue(null);
    // Act: ejecutar una única operación del componente.
    const r = caso.execute('empleado', '2026-09');
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('Primero debe generar');
  });
});
