
import { Test, TestingModule } from '@nestjs/testing';
import { ListarComisionesUseCase } from '@/modules/afp/use-cases/comision/listarComision.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('ListarComisionesUseCase', () => {
  let useCase: ListarComisionesUseCase;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      comisiones_afp: { count: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(async (queries) => Promise.all(queries)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarComisionesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<ListarComisionesUseCase>(ListarComisionesUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  it('Debería listar las comisiones paginadas correctamente', async () => {
    mockPrisma.comisiones_afp.count.mockResolvedValue(10);
    mockPrisma.comisiones_afp.findMany.mockResolvedValue([{ id: 'com-1' }]);

    const result = await useCase.listar({ page: 2, limit: 5 } as any);

    expect(result.data.length).toBe(1);
    expect(result.meta.totalPages).toBe(2);
    expect(mockPrisma.comisiones_afp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5, orderBy: { periodo_inicio: 'desc' } })
    );
  });

  it('Debería aplicar el filtro "solo_vigentes" consultando donde periodo_final sea NULL', async () => {
    mockPrisma.comisiones_afp.count.mockResolvedValue(2);
    mockPrisma.comisiones_afp.findMany.mockResolvedValue([]);

    await useCase.listar({ page: 1, limit: 10, solo_vigentes: true } as any);

    // Verificamos que se haya pasado la instrucción correcta a Prisma
    expect(mockPrisma.comisiones_afp.count).toHaveBeenCalledWith({
      where: { periodo_final: null }
    });
  });
});
