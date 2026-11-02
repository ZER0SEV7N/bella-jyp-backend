import { ConsultarTrabajoIntegracionUseCase } from '@/modules/integraciones/use-cases/consultarTrabajoIntegracion.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ConsultarTrabajoIntegracionUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = { integracionTrabajo: { findUnique: jest.fn() } };
  const caso = new ConsultarTrabajoIntegracionUseCase(prisma as never);
  beforeEach(() => jest.clearAllMocks());
  it('no expone un trabajo de recuperación en la consulta contable', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.integracionTrabajo.findUnique.mockResolvedValue(null);
    // Act: ejecutar una única operación del componente.
    const r = caso.execute('trabajo');
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('inexistente');
    expect(prisma.integracionTrabajo.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'trabajo', tipo: { not: 'RESET_PASSWORD' } },
        select: expect.not.objectContaining({
          solicitud_cifrada: true,
        }),
      })
    );
  });
  it('no abre un nombre no registrado en el manifiesto', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.integracionTrabajo.findUnique.mockResolvedValue({
      estado: 'PARCIAL',
      resultado: {
        archivos: [
          {
            nombre: 'propio.pdf',
            tipo: 'application/pdf',
            bytes: 10,
            sha256: '0'.repeat(64),
          },
        ],
        correos: [],
      },
    });
    // Act: ejecutar una única operación del componente.
    const r = caso.archivo('trabajo', 'archivo-ajeno.pdf');
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('no pertenece');
  });
});
