//test/modules/RRHH/Area/actualizarArea.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ActualizarAreaUseCase } from '@/modules/RRHH/organizacion/use-cases/area/actualizarArea.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

//Prueba unitaria para el caso de uso ActualizarAreaUseCase
describe('ActualizarAreaUseCase', () => {
  let useCase: ActualizarAreaUseCase;
  let mockPrisma: any;

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    mockPrisma = {
      area: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    //Crear un módulo de prueba para inyectar dependencias
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActualizarAreaUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = module.get<ActualizarAreaUseCase>(ActualizarAreaUseCase);
  });

  afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba

  it('Debería actualizar el área exitosamente', async () => {
    //Arrange
    const idArea = 'uuid-area-123';
    const payload = { nombre: 'Nuevo Nombre', descripcion: 'Nueva Desc' };

    //El área existe y está activa
    mockPrisma.area.findUnique.mockResolvedValue({
      id: idArea,
      deleted_at: null,
    });
    //Simular el retorno de la BD al actualizar
    mockPrisma.area.update.mockResolvedValue({ id: idArea, ...payload });

    //Act
    const result = await useCase.execute(idArea, payload);

    //Assert
    expect(result.nombre).toBe('Nuevo Nombre');
    expect(mockPrisma.area.update).toHaveBeenCalledWith({
      where: { id: idArea },
      data: { nombre: payload.nombre, descripcion: payload.descripcion },
    });
  });

  it('Debería lanzar NotFoundException si el área no existe', async () => {
    //Arrange: Prisma devuelve null porque no la encontró
    mockPrisma.area.findUnique.mockResolvedValue(null);

    //Act & Assert
    await expect(
      useCase.execute('uuid-404', { nombre: 'Test' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.area.update).not.toHaveBeenCalled();
  });

  it('Debería lanzar NotFoundException si el área existe pero tiene Soft Delete', async () => {
    //Arrange: Prisma encuentra el área, pero deleted_at tiene una fecha
    mockPrisma.area.findUnique.mockResolvedValue({
      id: 'uuid-123',
      deleted_at: new Date(),
    });

    //Act & Assert
    await expect(
      useCase.execute('uuid-123', { nombre: 'Test' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.area.update).not.toHaveBeenCalled();
  });

  it('Debería lanzar InternalServerErrorException si la base de datos falla en el update', async () => {
    //Arrange
    mockPrisma.area.findUnique.mockResolvedValue({
      id: 'uuid-123',
      deleted_at: null,
    });
    //Simular una caída de red o error de Prisma
    mockPrisma.area.update.mockRejectedValue(new Error('Connection timeout'));

    //Act & Assert
    await expect(
      useCase.execute('uuid-123', { nombre: 'Test' }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
