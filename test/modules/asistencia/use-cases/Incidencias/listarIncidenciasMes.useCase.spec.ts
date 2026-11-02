import { ListarIncidenciasMesUseCase } from '@/modules/asistencia/use-cases/Incidencias/listarIncidenciasMes.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ListarIncidenciasMesUseCase', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = {
    incidencias_mes: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const caso = new ListarIncidenciasMesUseCase(prisma as never);
  it('retorna listado vacío y metadatos del período', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.count.mockResolvedValue(0);
    prisma.incidencias_mes.findMany.mockResolvedValue([]);
    // Act: ejecutar una única operación del componente.
    const r = await caso.execute({
      periodo: '2026-09',
      page: 1,
      limit: 20,
    });
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    });
  });
  it('no devuelve detalle inexistente', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.incidencias_mes.findUnique.mockResolvedValue(null);
    // Act: ejecutar una única operación del componente.
    const r = caso.obtenerPorId('inexistente');
    // Assert: comprobar resultado, efectos y reglas de negocio.
    await expect(r).rejects.toThrow('no encontrado');
  });
});

describe('Listado de incidencias - combinaciones de filtros y resumen', () => {
  let prisma: any;
  let caso: ListarIncidenciasMesUseCase;
  beforeEach(() => {
    prisma = {
      incidencias_mes: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: 'resumen',
              empleados: null,
              horas_extras_25: 1.25,
              horas_extras_35: 0,
            },
          ]),
        findUnique: jest.fn(),
      },
    };
    caso = new ListarIncidenciasMesUseCase(prisma);
  });
  it.each([
    { area_id: 'area' },
    { busqueda: ' Ana ' },
    { area_id: 'area', busqueda: ' Ana ' },
  ])('aplica filtros independientes %j', async (filtro) => {
    // Arrange: área y búsqueda deben ser opcionales entre sí.
    // Act: consultar incidencias aprobadas en un periodo con espacios exteriores.
    const resultado = await caso.execute({
      page: 2,
      limit: 10,
      periodo: ' 2026-09 ',
      estado: 'APROBADO',
      ...filtro,
    });
    // Assert: conservar el periodo normalizado y representar decimales sin pérdida.
    const consulta = prisma.incidencias_mes.findMany.mock.calls[0][0];
    expect(consulta).toMatchObject({
      skip: 10,
      where: {
        periodo: '2026-09',
        estado: 'APROBADO',
        empleados: { deleted_at: null },
      },
    });
    if (filtro.area_id) expect(consulta.where.empleados.area_id).toBe('area');
    if (filtro.busqueda)
      expect(consulta.where.empleados.OR[1]).toEqual({
        nombre: { contains: 'Ana', mode: 'insensitive' },
      });
    expect(resultado.data[0]).toMatchObject({
      colaborador: '',
      area: 'Sin Área',
      cargo: 'Sin Cargo',
      horas_extras_25: '1.25',
      horas_extras_35: '0',
    });
  });
  it.each([new Error('fallo'), 'fallo'])(
    'propaga una consulta fallida como error HTTP %s',
    async (error) => {
      // Arrange: el repositorio no puede contar registros.
      prisma.incidencias_mes.count.mockRejectedValue(error);
      // Act: solicitar el listado.
      const operacion = caso.execute({
        page: 1,
        limit: 10,
        periodo: '2026-09',
      });
      // Assert: no presentar el fallo como cero incidencias.
      await expect(operacion).rejects.toThrow('Error al obtener');
    }
  );
});
