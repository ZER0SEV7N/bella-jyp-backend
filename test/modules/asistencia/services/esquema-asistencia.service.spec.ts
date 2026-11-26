import { EsquemaAsistenciaService } from '@/modules/asistencia/services/esquema-asistencia.service';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('EsquemaAsistenciaService', () => {
  const prisma = { $queryRaw: jest.fn() };
  const caso = new EsquemaAsistenciaService(prisma as never);
  it('no arranca si faltan las protecciones críticas', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.$queryRaw
      .mockResolvedValueOnce([{ instalada: true }])
      .mockResolvedValueOnce([{ cantidad: 0 }]);
    // Act: ejecutar una única operación del componente.
    const r = caso.onModuleInit();
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('triggers');
  });
});
