import { ListarIncidenciasMesUseCase } from '@/modules/asistencia/use-cases/Incidencias/listarIncidenciasMes.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ListarIncidenciasMesUseCase', () => {
  const prisma = {
    incidencias_mes: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    historial_planillas: {
      findMany: jest.fn(),
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
    expect(prisma.historial_planillas.findMany).not.toHaveBeenCalled();
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
  let prisma: {
    incidencias_mes: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    historial_planillas: {
      findMany: jest.Mock;
    };
  };
  let caso: ListarIncidenciasMesUseCase;
  beforeEach(() => {
    prisma = {
      incidencias_mes: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'resumen',
            empleado_id: 'emp-1',
            empleados: null,
            horas_extras_25: 1.25,
            horas_extras_35: 0,
            estado: 'PENDIENTE',
            vigente: true,
            completo: true,
            pendientes: 0,
          },
        ]),
        findUnique: jest.fn(),
      },
      historial_planillas: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    caso = new ListarIncidenciasMesUseCase(prisma as never);
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
    const calls = prisma.incidencias_mes.findMany.mock.calls as Array<
      [
        {
          skip: number;
          where: {
            periodo: string;
            estado?: string;
            empleados?: {
              deleted_at: null;
              area_id?: string;
              OR?: Array<Record<string, unknown>>;
            };
          };
        },
      ]
    >;
    const consulta = calls[0][0];
    expect(consulta).toMatchObject({
      skip: 10,
      where: {
        periodo: '2026-09',
        estado: 'APROBADO',
        empleados: { deleted_at: null },
      },
    });
    if (filtro.area_id) {
      expect(consulta.where.empleados?.area_id).toBe('area');
    }
    if (filtro.busqueda) {
      expect(consulta.where.empleados?.OR?.[1]).toEqual({
        nombre: { contains: 'Ana', mode: 'insensitive' },
      });
    }
    expect(resultado.data[0]).toMatchObject({
      colaborador: '',
      area: 'Sin Área',
      cargo: 'Sin Cargo',
      horas_extras_25: '1.25',
      horas_extras_35: '0',
      acciones: {
        aprobar: null,
        rechazar: null,
        reabrir: 'El resumen ya está pendiente.',
      },
    });
    expect(prisma.historial_planillas.findMany).toHaveBeenCalledWith({
      where: { periodo: '2026-09', empleado_id: { in: ['emp-1'] } },
      select: { empleado_id: true, estado: true },
    });
  });
  it('bloquea acciones de la fila cuando la planilla del empleado ya no está abierta', async () => {
    prisma.historial_planillas.findMany.mockResolvedValue([
      { empleado_id: 'emp-1', estado: 'CONGELADO' },
    ]);

    const resultado = await caso.execute({
      page: 1,
      limit: 10,
      periodo: '2026-09',
    });

    expect(resultado.data[0].acciones).toEqual({
      aprobar:
        'La planilla de este mes ya no está abierta: no se puede cambiar su asistencia.',
      rechazar:
        'La planilla de este mes ya no está abierta: no se puede cambiar su asistencia.',
      reabrir:
        'La planilla de este mes ya no está abierta: no se puede cambiar su asistencia.',
    });
  });
  it('propaga errores de repositorio sin ocultarlos tras un 500 genérico', async () => {
    // Arrange: el repositorio falla al consultar la base de datos.
    const errorDb = new Error('fallo de consulta');
    prisma.incidencias_mes.count.mockRejectedValue(errorDb);
    // Act: solicitar el listado.
    const operacion = caso.execute({
      page: 1,
      limit: 10,
      periodo: '2026-09',
    });
    // Assert: propagar la excepción original al filtro global.
    await expect(operacion).rejects.toBe(errorDb);
  });
});
