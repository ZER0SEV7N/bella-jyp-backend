import { Test, TestingModule } from '@nestjs/testing';
import { CrearAreaUseCase } from '@/modules/RRHH/use-cases/area/crearArea.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
describe('CrearAreaUseCase', () => {
  let useCase: CrearAreaUseCase;
  let prisma: PrismaService;

  // Mock del PrismaService
  const mockPrisma = {
    area: {
      create: jest.fn(),
    },
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrearAreaUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<CrearAreaUseCase>(CrearAreaUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Deberia crear un area correctamente y retornar el objeto creado', async () => {
    // Arrange: Datos que recibe el useCase
    const input = {
      nombre: 'Nombre20',
      descripcion: 'Descripcion25',
    };

    // Datos que Prisma "devolvería" (simulados)
    const mockCreatedArea = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      ...input,
      activo: true,
      deleted_at: null,
    };

    // Configuramos el mock de Prisma para que resuelva con éxito
    mockPrisma.area.create.mockResolvedValue(mockCreatedArea);

    // Act: Ejecutamos el caso de uso
    const result = await useCase.execute(input);

    // Assert: Verificamos que Prisma fue llamado con los datos correctos
    expect(mockPrisma.area.create).toHaveBeenCalledWith({
      data: {
        nombre: input.nombre,
        descripcion: input.descripcion,
        // Si tu base de datos requiere 'activo: true' por defecto,
        // verifica que se esté enviando aquí.
      },
    });

    // Verificamos que el resultado sea el esperado
    expect(result).toEqual(mockCreatedArea);
  });
});
