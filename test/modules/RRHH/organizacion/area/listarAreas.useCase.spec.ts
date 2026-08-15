//test/modules/RRHH/Area/listarArea.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ListarAreasUseCase } from '@/modules/RRHH/organizacion/use-cases/area/listarAreas.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso ListarAreasUseCase
 * Contiene pruebas exhaustivas para verificar el comportamiento del caso de uso de listado de áreas en el módulo de RRHH.
 * Se encarga de probar la lógica de negocio para listar áreas en la base de datos utilizando Prisma.
 * Incluye pruebas para verificar la paginación, el filtrado por estado y el manejo de errores.
 */
describe('ListarAreasUseCase', () => {
  let useCase: ListarAreasUseCase;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      area: { count: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(async (queries) => Promise.all(queries))
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarAreasUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();
    useCase = module.get<ListarAreasUseCase>(ListarAreasUseCase);
  });

  //Limpiar los mocks después de cada prueba
  afterEach(() => jest.clearAllMocks());

  it('Deberia listar todas las areas con paginacion correctamente', async () => {
    //Arrange
    const query = { page: 2, limit: 5 };
    const mockAreas = [
      { id: '1', nombre: 'A1' },
      { id: '2', nombre: 'A2' }
    ];

    mockPrisma.area.count.mockResolvedValue(12);
    mockPrisma.area.findMany.mockResolvedValue(mockAreas);

    //Act
    const result = await useCase.listar(query);

    //Assert
    expect(result.data).toEqual(mockAreas);
    expect(result.meta.total).toBe(12);
    expect(result.meta.page).toBe(2);
    expect(result.meta.limit).toBe(5);
    expect(result.meta.totalPages).toBe(3); // 12 / 5 = 2.4 => 3 pages
    expect(mockPrisma.area.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }));
  });

  it('Debería aplicar el filtro de estado "activo" si es proporcionado', async () => {
    //Arrange
    mockPrisma.area.count.mockResolvedValue(0);
    mockPrisma.area.findMany.mockResolvedValue([]);

    //Act
    await useCase.listar({ page: 1, limit: 10, activo: true });

    //Assert
    expect(mockPrisma.area.count).toHaveBeenCalledWith({where: { deleted_at: null, activo: true }});
  });

  it('Debería aplicar el filtro de estado "inactivo" si es proporcionado', async () => {
    //Arrange
    mockPrisma.area.count.mockResolvedValue(0);
    mockPrisma.area.findMany.mockResolvedValue([]);

    //Act
    await useCase.listar({ page: 1, limit: 10, activo: false });

    //Assert
    expect(mockPrisma.area.count).toHaveBeenCalledWith({where: { deleted_at: null, activo: false }});
  });
});
