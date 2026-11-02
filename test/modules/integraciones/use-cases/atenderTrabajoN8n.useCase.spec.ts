import { AtenderTrabajoN8nUseCase } from '@/modules/integraciones/use-cases/atenderTrabajoN8N.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('AtenderTrabajoN8nUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = {
    integracionTrabajo: {
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const caso = new AtenderTrabajoN8nUseCase(prisma as never);
  it('un callback de otro ejecutor no finaliza el trabajo', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.integracionTrabajo.updateMany.mockResolvedValue({ count: 0 });
    // Act: ejecutar una única operación del componente.
    const r = caso.finalizar('trabajo', 'otro-ejecutor', {
      archivos: [],
      correos: [],
    });
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('ejecución');
    expect(prisma.integracionTrabajo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'trabajo',
          estado: 'PROCESANDO',
          ejecucion_id: 'otro-ejecutor',
        },
      })
    );
  });
  it('un correo indeterminado conserva el archivo y marca parcial', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.integracionTrabajo.updateMany.mockResolvedValue({ count: 1 });
    // Act: ejecutar una única operación del componente.
    await caso.finalizar('trabajo', 'ejecutor', {
      archivos: [],
      correos: [{ estado: 'INDETERMINADO' }],
    });
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(prisma.integracionTrabajo.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: 'PARCIAL' }),
      })
    );
  });
  it('un segundo reclamo no obtiene la concesión', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.integracionTrabajo.updateMany.mockResolvedValue({ count: 0 });
    // Act: ejecutar una única operación del componente.
    const r = caso.reclamar('trabajo', 'ejecutor');
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('reclamado');
  });
});
