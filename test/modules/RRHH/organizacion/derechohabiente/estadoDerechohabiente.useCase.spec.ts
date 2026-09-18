import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { EstadoDerechohabienteUseCase } from '@/modules/RRHH/organizacion/use-cases/derechohabiente/estadoDerechohabiente.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('EstadoDerechohabienteUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: EstadoDerechohabienteUseCase;
  let prisma: PrismaService;

  const mockPrisma = {
    derechohabientes: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const idFamiliar = '018f4a7c-dh-0000-0000-000000000001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadoDerechohabienteUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<EstadoDerechohabienteUseCase>(EstadoDerechohabienteUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // =========================================================================
  // 1. desactivar()
  // =========================================================================
  describe('desactivar()', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe desactivar al derechohabiente aplicando soft-delete (deleted_at)', async () => {
        // Arrange
        mockPrisma.derechohabientes.findUnique.mockResolvedValue({
          id: idFamiliar,
          activo: true,
          deleted_at: null,
        });

        mockPrisma.derechohabientes.update.mockResolvedValue({
          id: idFamiliar,
          activo: false,
          deleted_at: new Date(),
        });

        // Act
        const result = await useCase.desactivar(idFamiliar);

        // Assert
        expect(result.activo).toBe(false);
        expect(mockPrisma.derechohabientes.update).toHaveBeenCalledWith({
          where: { id: idFamiliar },
          data: { activo: false, deleted_at: expect.any(Date) },
        });
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar NotFoundException si el familiar no existe o ya está inactivo', async () => {
        // Arrange
        mockPrisma.derechohabientes.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(useCase.desactivar(idFamiliar)).rejects.toThrow(NotFoundException);
        expect(mockPrisma.derechohabientes.update).not.toHaveBeenCalled();
      });

      it('Debe transformar fallos de BD a InternalServerErrorException', async () => {
        // Arrange
        mockPrisma.derechohabientes.findUnique.mockResolvedValue({ id: idFamiliar, activo: true, deleted_at: null });
        mockPrisma.derechohabientes.update.mockRejectedValue(new Error('PostgreSQL Error'));

        // Act & Assert
        await expect(useCase.desactivar(idFamiliar)).rejects.toThrow(InternalServerErrorException);
      });
    });
  });

  // =========================================================================
  // 2. reactivar()
  // =========================================================================
  describe('reactivar()', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe restaurar al derechohabiente estableciendo activo=true y deleted_at=null', async () => {
        // Arrange
        mockPrisma.derechohabientes.findUnique.mockResolvedValue({
          id: idFamiliar,
          activo: false,
          deleted_at: new Date(),
        });

        mockPrisma.derechohabientes.update.mockResolvedValue({
          id: idFamiliar,
          activo: true,
          deleted_at: null,
        });

        // Act
        const result = await useCase.reactivar(idFamiliar);

        // Assert
        expect(result.activo).toBe(true);
        expect(mockPrisma.derechohabientes.update).toHaveBeenCalledWith({
          where: { id: idFamiliar },
          data: { activo: true, deleted_at: null },
        });
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar NotFoundException si el derechohabiente no existe', async () => {
        // Arrange
        mockPrisma.derechohabientes.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(useCase.reactivar(idFamiliar)).rejects.toThrow(NotFoundException);
      });

      it('Debe lanzar BadRequestException si el familiar ya se encuentra activo', async () => {
        // Arrange
        mockPrisma.derechohabientes.findUnique.mockResolvedValue({
          id: idFamiliar,
          activo: true,
          deleted_at: null,
        });

        // Act & Assert
        await expect(useCase.reactivar(idFamiliar)).rejects.toThrow(BadRequestException);
        expect(mockPrisma.derechohabientes.update).not.toHaveBeenCalled();
      });
    });
  });
});