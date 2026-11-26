import { DatosExportacionService } from '@/modules/integraciones/services/datos-exportacion.service';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('DatosExportacionService', () => {
  const prisma = {
    integracionTrabajo: { findUnique: jest.fn() },
    historial_planillas: { findUnique: jest.fn() },
  };
  const caso = new DatosExportacionService(prisma as never);
  it('no entrega datos a un ejecutor sin concesión', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.integracionTrabajo.findUnique.mockResolvedValue({
      estado: 'PROCESANDO',
      ejecucion_id: 'titular',
    });
    // Act: ejecutar una única operación del componente.
    const r = caso.pagina('job', 0, 'otro');
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('concesión');
    expect(prisma.historial_planillas.findUnique).not.toHaveBeenCalled();
  });
  it('termina una página vacía sin consultar planillas ajenas', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.integracionTrabajo.findUnique.mockResolvedValue({
      estado: 'PROCESANDO',
      ejecucion_id: 'titular',
      planilla_ids: [],
    });
    // Act: ejecutar una única operación del componente.
    const r = await caso.pagina('job', 0, 'titular');
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r).toEqual({ filas: [], siguiente: null });
  });
});
