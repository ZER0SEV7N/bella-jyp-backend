//test/RRHH/Area/crearArea.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException
} from '@nestjs/common';
import { CrearAreaUseCase } from '@/modules/RRHH/organizacion/use-cases/area/crearArea.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

//Mock de Crypto para simular la generación de UUID
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-1234-5678')
}));

describe('CrearAreaUseCase', () => {
  let useCase: CrearAreaUseCase;
  let mockPrisma: any;

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    mockPrisma = {
      area: {
        findFirst: jest.fn(),
        create: jest.fn()
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrearAreaUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();
    useCase = module.get<CrearAreaUseCase>(CrearAreaUseCase);
  });

  //Limpiar los mocks después de cada prueba
  afterEach(() => jest.clearAllMocks());

  it('Debería crear una nueva área correctamente (Happy Path)', async () => {
    //Arrange: No existe ningún área con ese nombre
    mockPrisma.area.findFirst.mockResolvedValue(null);

    const payload = {
      nombre: 'Recursos Humanos',
      descripcion: 'Área principal'
    };
    const mockCreatedArea = { id: 'uuid-area-1234', ...payload, activo: true };
    mockPrisma.area.create.mockResolvedValue(mockCreatedArea);

    //Act
    const result = await useCase.execute(payload);

    //Assert
    expect(result.id).toBe('uuid-area-1234');
    expect(result.nombre).toBe('Recursos Humanos');
    expect(mockPrisma.area.create).toHaveBeenCalled();
  });

  it('Debería lanzar BadRequestException si el área ya existe (Duplicado)', async () => {
    //Arrange: Prisma encuentra un área que ya se llama igual
    mockPrisma.area.findFirst.mockResolvedValue({
      id: 'uuid-existente',
      nombre: 'Recursos Humanos'
    });

    const payload = { nombre: 'Recursos Humanos', descripcion: 'Otra área' };

    //Act & Assert
    await expect(useCase.execute(payload)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.area.create).not.toHaveBeenCalled(); // Protegemos la BD de un insert fallido
  });

  it('Debería lanzar BadRequestException si no se envía el nombre del área (Falta de Atributo)', async () => {
    //Arrange: Payload inválido forzado saltándose el tipado
    const payloadInvalido = { descripcion: 'Área sin nombre' } as any;

    //Act & Assert
    await expect(useCase.execute(payloadInvalido)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(payloadInvalido)).rejects.toThrow('El nombre del área es estrictamente obligatorio.');

    //Verificar que no se haya llamado a la base de datos
    expect(mockPrisma.area.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.area.create).not.toHaveBeenCalled();
  });

  it('Debería lanzar InternalServerErrorException si la base de datos falla al crear', async () => {
    //Arrange: Todo va bien, pero la BD se cae en el momento exacto del insert
    mockPrisma.area.findFirst.mockResolvedValue(null);
    mockPrisma.area.create.mockRejectedValue(new Error('Database Connection Lost'));

    //Act & Assert
    const payload = { nombre: 'Sistemas' };
    await expect(useCase.execute(payload)).rejects.toThrow(InternalServerErrorException);
  });
});
