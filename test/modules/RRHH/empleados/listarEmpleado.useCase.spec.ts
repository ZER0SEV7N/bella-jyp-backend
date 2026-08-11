//test/modules/RRHH/empleados/listarEmpleado.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ListarEmpleadosUseCase } from '@/modules/RRHH/use-cases/empleado/listarEmpleados.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso ListarEmpleadosUseCase.
 * Se utiliza Jest para simular las dependencias y verificar el comportamiento del caso de uso.
 * Se mockea el servicio PrismaService para evitar interacciones reales con la base de datos.
 * Esto permite probar únicamente la lógica del caso de uso y su interacción con PrismaService.
 */
describe('ListarEmpleadosUseCase', () => {
  let useCase: ListarEmpleadosUseCase;
  let mockPrisma: any;

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    mockPrisma = {
      empleados: { count: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(async (queries) => Promise.all(queries)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarEmpleadosUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<ListarEmpleadosUseCase>(ListarEmpleadosUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  it('Debería listar empleados con paginación correctamente', async () => {
    //Arrange: Simulamos la respuesta de Prisma para contar y listar empleados
    const mockEmpleados = [
      { id: '1', nombre: 'Juan' },
      { id: '2', nombre: 'Ana' },
    ];
    mockPrisma.empleados.count.mockResolvedValue(15);
    mockPrisma.empleados.findMany.mockResolvedValue(mockEmpleados);

    //Act: Ejecutamos el caso de uso con parámetros de paginación
    const result = await useCase.execute({ page: 2, limit: 10 });

    //Assert: Verificamos que la respuesta sea la esperada y que Prisma haya sido llamado correctamente
    expect(result.data).toEqual(mockEmpleados);
    expect(result.meta.total).toBe(15);
    expect(result.meta.totalPages).toBe(2);
    expect(mockPrisma.empleados.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: { apellido: 'asc' },
      }),
    );
  });

  it('Debería aplicar los filtros dinámicos correctamente (area_id, cargo_id, activo)', async () => {
    //Arrange: Simulamos la respuesta de Prisma para contar y listar empleados con filtros
    mockPrisma.empleados.count.mockResolvedValue(1);
    mockPrisma.empleados.findMany.mockResolvedValue([]);

    //Act: Ejecutamos el caso de uso con filtros específicos
    await useCase.execute({
      page: 1,
      limit: 10,
      area_id: 'area-1',
      cargo_id: 'cargo-1',
      activo: true,
    });

    //Assert: Verificamos que Prisma haya sido llamado con los filtros correctos
    expect(mockPrisma.empleados.count).toHaveBeenCalledWith({
      where: {
        deleted_at: null,
        area_id: 'area-1',
        cargo_id: 'cargo-1',
        activo: true,
      },
    });
  });
});
