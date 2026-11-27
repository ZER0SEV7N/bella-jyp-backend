import { ContarIncidenciasMesUseCase } from '@/modules/asistencia/use-cases/Incidencias/contarIncidenciasMes.useCase';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica conteos y filtros. */
describe('ContarIncidenciasMesUseCase', () => {
  let prisma: {
    incidencias_mes: {
      groupBy: jest.Mock;
    };
  };
  let caso: ContarIncidenciasMesUseCase;

  beforeEach(() => {
    prisma = {
      incidencias_mes: {
        groupBy: jest.fn(),
      },
    };
    caso = new ContarIncidenciasMesUseCase(prisma as never);
  });

  it('devuelve los tres estados rellenando con cero los estados faltantes', async () => {
    // Arrange: la consulta groupBy solo retorna estados con al menos un registro.
    prisma.incidencias_mes.groupBy.mockResolvedValue([
      { estado: 'PENDIENTE', _count: { _all: 4 } },
      { estado: 'APROBADO', _count: { _all: 7 } },
    ]);

    // Act: ejecutar el conteo para el período sin filtro de área.
    const resultado = await caso.execute({ periodo: ' 2026-09 ' });

    // Assert: RECHAZADO se completa con 0 y el where conserva el período normalizado.
    expect(resultado).toEqual({
      PENDIENTE: 4,
      APROBADO: 7,
      RECHAZADO: 0,
    });
    expect(prisma.incidencias_mes.groupBy).toHaveBeenCalledWith({
      by: ['estado'],
      where: { periodo: '2026-09' },
      _count: { _all: true },
    });
  });

  it('aplica area_id al filtro de empleados y devuelve ceros cuando no hay registros', async () => {
    // Arrange: sin incidencias registradas para el área filtrada.
    prisma.incidencias_mes.groupBy.mockResolvedValue([]);

    // Act: consultar totales filtrados por área.
    const resultado = await caso.execute({
      periodo: '2026-09',
      area_id: 'area-123',
    });

    // Assert: aplica el criterio de vigencia (ASI-F6) y area_id.
    expect(resultado).toEqual({
      PENDIENTE: 0,
      APROBADO: 0,
      RECHAZADO: 0,
    });
    expect(prisma.incidencias_mes.groupBy).toHaveBeenCalledWith({
      by: ['estado'],
      where: {
        periodo: '2026-09',
        empleados: expect.objectContaining({
          area_id: 'area-123',
        }),
      },
      _count: { _all: true },
    });
  });
});
