
import { PrismaService } from '@/common/prisma/prisma.service';
import { ListarCargosUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/listarCargos.useCase';
import { Test, TestingModule } from '@nestjs/testing';
import type { ListarCargosQueryDto } from '@jyp/shared-contracts';

describe('ListarCargosUseCase', () => {
  let useCase: ListarCargosUseCase;
  let mockPrisma = {
    cargo: { count: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    //simular modulo
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarCargosUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = module.get<ListarCargosUseCase>(ListarCargosUseCase);

    //el $transaction real ejecuta las promesas del arreglo; lo simulamos igual
    mockPrisma.$transaction.mockImplementation((queries: Promise<any>[]) =>
      Promise.all(queries),
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('debe listar cargos con paginación por defecto (page 1, limit 50)', async () => {
    const query = {} as ListarCargosQueryDto;

    const cargosSimulados = [
      { id: 'cargo-1', nombre: 'Analista', area: { nombre: 'Sistemas' } },
    ];
    mockPrisma.cargo.count.mockResolvedValueOnce(1);
    mockPrisma.cargo.findMany.mockResolvedValueOnce(cargosSimulados);

    const resultado = await useCase.listar(query);

    expect(resultado).toEqual({
      data: cargosSimulados,
      meta: {
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      },
    });

    expect(mockPrisma.cargo.count).toHaveBeenCalledWith({
      where: { deleted_at: null },
    });
    expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith({
      where: { deleted_at: null },
      skip: 0,
      take: 50,
      orderBy: { nombre: 'asc' },
      include: { area: { select: { nombre: true } } },
    });
  });

  it('debe calcular correctamente el skip cuando se envía page y limit', async () => {
    const query = { page: 3, limit: 10 } as ListarCargosQueryDto;

    mockPrisma.cargo.count.mockResolvedValueOnce(25);
    mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

    const resultado = await useCase.listar(query);

    //page 3, limit 10 -> skip = (3-1)*10 = 20
    expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );

    expect(resultado.meta).toEqual({
      total: 25,
      page: 3,
      limit: 10,
      totalPages: 3, // Math.ceil(25/10)
    });
  });

  it('debe filtrar por id_area cuando se envía en el query', async () => {
    const query = { id_area: 'area-uuid-1' } as ListarCargosQueryDto;

    mockPrisma.cargo.count.mockResolvedValueOnce(0);
    mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

    await useCase.listar(query);

    expect(mockPrisma.cargo.count).toHaveBeenCalledWith({
      where: { deleted_at: null, id_area: 'area-uuid-1' },
    });
    expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deleted_at: null, id_area: 'area-uuid-1' },
      }),
    );
  });

  it('debe filtrar por activo cuando se envía en el query (activo: true)', async () => {
    const query = { activo: true } as ListarCargosQueryDto;

    mockPrisma.cargo.count.mockResolvedValueOnce(0);
    mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

    await useCase.listar(query);

    expect(mockPrisma.cargo.count).toHaveBeenCalledWith({
      where: { deleted_at: null, activo: true },
    });
  });

  it('debe filtrar por activo cuando se envía en el query (activo: false)', async () => {
    const query = { activo: false } as ListarCargosQueryDto;

    mockPrisma.cargo.count.mockResolvedValueOnce(0);
    mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

    await useCase.listar(query);

    //activo false tambien debe filtrarse explicitamente, no ignorarse
    expect(mockPrisma.cargo.count).toHaveBeenCalledWith({
      where: { deleted_at: null, activo: false },
    });
  });

  it('no debe filtrar por activo si no viene en el query (undefined)', async () => {
    const query = {} as ListarCargosQueryDto;

    mockPrisma.cargo.count.mockResolvedValueOnce(0);
    mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

    await useCase.listar(query);

    expect(mockPrisma.cargo.count).toHaveBeenCalledWith({
      where: { deleted_at: null },
    });
  });

  it('debe combinar filtros de id_area y activo al mismo tiempo', async () => {
    const query = {
      id_area: 'area-uuid-1',
      activo: true,
      page: 2,
      limit: 5,
    } as ListarCargosQueryDto;

    mockPrisma.cargo.count.mockResolvedValueOnce(7);
    mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

    const resultado = await useCase.listar(query);

    expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith({
      where: { deleted_at: null, id_area: 'area-uuid-1', activo: true },
      skip: 5, // (2-1)*5
      take: 5,
      orderBy: { nombre: 'asc' },
      include: { area: { select: { nombre: true } } },
    });

    expect(resultado.meta.totalPages).toBe(2); // Math.ceil(7/5)
  });
});
