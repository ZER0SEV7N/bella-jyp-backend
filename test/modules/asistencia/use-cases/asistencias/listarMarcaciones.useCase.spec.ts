import { ListarMarcacionesUseCase } from '@/modules/asistencia/use-cases/asistencias/listarMarcaciones.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ListarMarcacionesUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = {
    asistencia_marcacion: { count: jest.fn(), findMany: jest.fn() },
  };
  const caso = new ListarMarcacionesUseCase(prisma as never);
  it('pagina sin exponer el legajo completo', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.asistencia_marcacion.count.mockResolvedValue(11);
    prisma.asistencia_marcacion.findMany.mockResolvedValue([
      {
        id: 'marca',
        empleados: {
          id: 'e',
          nombre: 'Ana',
          apellido: 'Ramos',
          nro_documento: '09900001',
        },
      },
    ]);
    // Act: ejecutar una única operación del componente.
    const r = await caso.execute({
      page: 2,
      limit: 10,
      fecha_inicio: '2026-09-01',
      fecha_fin: '2026-09-30',
    });
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r.meta.totalPages).toBe(2);
    expect(r.data[0].colaborador).toBe('Ana Ramos');
    expect(prisma.asistencia_marcacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: {
          fecha_hora: {
            gte: new Date('2026-09-01T05:00:00Z'),
            lt: new Date('2026-10-01T05:00:00Z'),
          },
        },
      })
    );
  });
  it('convierte un fallo de consulta en error HTTP de servidor', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.asistencia_marcacion.count.mockRejectedValue(new Error('BD caída'));
    prisma.asistencia_marcacion.findMany.mockResolvedValue([]);
    // Act: ejecutar una única operación del componente.
    const r = caso.execute({ page: 1, limit: 10 });
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('Error al obtener');
  });
});

describe('Listado de marcaciones - filtros y zona horaria', () => {
  let prisma: any;
  let caso: ListarMarcacionesUseCase;
  beforeEach(() => {
    prisma = {
      asistencia_marcacion: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'marca', empleados: null }]),
      },
    };
    caso = new ListarMarcacionesUseCase(prisma);
  });
  it.each([
    { fecha_inicio: '2026-09-01' },
    { fecha_fin: '2026-09-30' },
    { fecha_inicio: '2026-09-01', fecha_fin: '2026-09-30' },
  ])('aplica el rango local %j', async (fechas) => {
    // Arrange: filtro unilateral o completo; las fechas de consulta son civiles de Perú.
    // Act: consultar la segunda página con empleado y tipo de marca.
    const resultado = await caso.execute({
      page: 2,
      limit: 10,
      empleado_id: 'empleado',
      tipo_marcacion: 'ENTRADA',
      ...fechas,
    });
    // Assert: fin exclusivo al día siguiente; no omitir las marcas de las últimas horas del día.
    const consulta = prisma.asistencia_marcacion.findMany.mock.calls[0][0];
    expect(consulta).toMatchObject({
      skip: 10,
      take: 10,
      where: { empleado_id: 'empleado', tipo_marcacion: 'ENTRADA' },
    });
    if (fechas.fecha_inicio)
      expect(consulta.where.fecha_hora.gte.toISOString()).toBe(
        '2026-09-01T05:00:00.000Z'
      );
    if (fechas.fecha_fin)
      expect(consulta.where.fecha_hora.lt.toISOString()).toBe(
        '2026-10-01T05:00:00.000Z'
      );
    expect(resultado.data[0]).toMatchObject({
      colaborador: '',
      nro_documento: '',
    });
  });
  it.each([new Error('sin conexión'), 'sin conexión'])(
    'controla el fallo de consulta %s',
    async (error) => {
      // Arrange: una de las consultas paralelas rechaza.
      prisma.asistencia_marcacion.count.mockRejectedValue(error);
      // Act: obtener el listado.
      const operacion = caso.execute({ page: 1, limit: 10 });
      // Assert: no devolver una página incompleta como si fuera exitosa.
      await expect(operacion).rejects.toThrow('Error al obtener');
    }
  );
});
