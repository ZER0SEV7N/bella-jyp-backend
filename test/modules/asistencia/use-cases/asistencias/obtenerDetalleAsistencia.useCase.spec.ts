import { ObtenerDetalleAsistenciaUseCase } from '@/modules/asistencia/use-cases/asistencias/obtenerDetalleAsistencia.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ObtenerDetalleAsistenciaUseCase', () => {
  const prisma = {
    incidencias_mes: { findUnique: jest.fn() },
    historial_planillas: { findUnique: jest.fn() },
  };
  const caso = new ObtenerDetalleAsistenciaUseCase(prisma as never);
  beforeEach(() => jest.clearAllMocks());
  it('devuelve el resumen solicitado junto con las acciones permitidas', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    const resumen = {
      id: 'resumen',
      estado: 'PENDIENTE',
      vigente: true,
      completo: true,
      pendientes: 0,
      detalle: {
        dias: [{ alertas: ['JORNADA_HISTORICA_NO_ASIGNADA'] }],
      },
    };
    prisma.incidencias_mes.findUnique.mockResolvedValue(resumen);
    prisma.historial_planillas.findUnique.mockResolvedValue({
      estado: 'ABIERTO',
    });
    // Act: ejecutar una única operación del componente.
    const r = await caso.execute('empleado', '2026-09');
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r).toEqual({
      ...resumen,
      acciones: {
        aprobar:
          'Hay 1 día sin jornada asignada: asigna una jornada y actualiza el resumen para poder aprobarlo.',
        rechazar: null,
        reabrir: 'El resumen ya está pendiente.',
      },
    });
    expect(prisma.incidencias_mes.findUnique).toHaveBeenCalledWith({
      where: {
        empleado_id_periodo: {
          empleado_id: 'empleado',
          periodo: '2026-09',
        },
      },
    });
    expect(prisma.historial_planillas.findUnique).toHaveBeenCalledWith({
      where: {
        empleado_id_periodo: {
          empleado_id: 'empleado',
          periodo: '2026-09',
        },
      },
      select: { estado: true },
    });
  });
  it('rechaza cuando aún no se generó el resumen', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.findUnique.mockResolvedValue(null);
    prisma.historial_planillas.findUnique.mockResolvedValue(null);
    // Act: ejecutar una única operación del componente.
    const r = caso.execute('empleado', '2026-09');
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('Primero debe generar');
  });
});
