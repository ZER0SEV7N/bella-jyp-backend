import { PrismaService } from '@/common/prisma/prisma.service';
import { ActiveCargoUseCase } from '@/modules/RRHH/use-cases/cargos/activeCargo.useCase';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZodError } from 'zod';

describe('ActiveCargoUseCase', () => {
  let useCase: ActiveCargoUseCase;
  let mockPrisma = {
    cargo: { update: jest.fn() },
  };

  beforeEach(async () => {
    //simular modulo
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActiveCargoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = module.get<ActiveCargoUseCase>(ActiveCargoUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  it('debe activar/restaurar el cargo correctamente', async () => {
    const idCargo = 'id-cargo-activar';

    //cargo ya actualizado que retornaria prisma
    const cargoActivado = {
      id: idCargo,
      activo: true,
      deleted_at: null,
    };
    mockPrisma.cargo.update.mockResolvedValueOnce(cargoActivado);

    const resultado = await useCase.execute(idCargo);

    expect(resultado).toEqual({
      state: true,
      message: 'Cargo restaurado/activado correctamente',
      data: cargoActivado,
    });

    expect(mockPrisma.cargo.update).toHaveBeenCalledWith({
      where: { id: idCargo },
      data: {
        activo: true,
        deleted_at: null,
      },
    });
  });

  it('debe lanzar BadRequestException si prisma falla al actualizar (ej: id no existe)', async () => {
    const idCargo = 'id-cargo-inexistente';

    mockPrisma.cargo.update.mockRejectedValueOnce(
      new Error('Record to update not found'),
    );

    await expect(useCase.execute(idCargo)).rejects.toThrow(BadRequestException);
  });

  it('debe lanzar ZodError si el id no es un string (no lo envuelve en BadRequestException)', async () => {
    //la validacion de zod esta FUERA del try/catch, por lo que no se transforma
    await expect(useCase.execute(123 as unknown as string)).rejects.toThrow(
      ZodError,
    );

    //prisma nunca deberia llegar a llamarse
    expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
  });
});
