//test/modules/RRHH/Area/reactivarArea.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ActiveAreaUseCase } from '@/modules/RRHH/organizacion/use-cases/area/activeArea.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

//Prueba unitaria para el caso de uso ActiveAreaUseCase
describe('ActiveAreaUseCase', () => {
  let useCase: ActiveAreaUseCase;
  let mockPrisma: any;

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    mockPrisma = { area: { update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActiveAreaUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<ActiveAreaUseCase>(ActiveAreaUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  it('Deberia reactivar un area correctamente', async () => {
    //Arrange
    const idArea = '123e4567-e89b-12d3-a456-426614174000';
    mockPrisma.area.update.mockResolvedValue({ id: idArea, activo: true });

    //Act
    const result = await useCase.execute(idArea);

    //Assert
    expect(result.state).toBe(true);
    expect(result.data).toEqual({ id: idArea, activo: true });
    expect(result.message).toBe('Área reactivada correctamente');
  });

  it('Deberia lanzar BadRequestException si el ID no es un UUID válido', async () => {
    //Arrange
    const invalidId = 'invalid-uuid';

    //Act & Assert
    await expect(useCase.execute(invalidId)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.area.update).not.toHaveBeenCalled();
  });

  it('Deberia lanzar BadRequestException si la base de datos falla al actualizar', async () => {
    //Arrange
    const idArea = '123e4567-e89b-12d3-a456-426614174000';
    mockPrisma.area.update.mockRejectedValue(new Error('Database Error'));

    //Act & Assert
    await expect(useCase.execute(idArea)).rejects.toThrow(BadRequestException);
  });
});
