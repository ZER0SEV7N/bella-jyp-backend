// src/modules/RRHH/use-cases/cargos/crearCargo.UseCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CrearCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/crearCargo.UseCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearCargoDto } from '@jyp/shared-contracts';

describe('CrearCargoUseCase', () => {
  let useCase: CrearCargoUseCase;
  let prisma: PrismaService;

  // Mock del PrismaService: solo los métodos/modelos que usa el use case
  const mockPrismaService = {
    area: {findUnique: jest.fn()},
    cargo: {
      findFirst: jest.fn(),
      create: jest.fn()
    }
  };

  const payload: CrearCargoDto = {
    id_area: 'area-uuid-1',
    nombre: 'Analista de Sistemas',
    descripcion: 'Encargado de soporte y desarrollo',
  } as CrearCargoDto;

  const areaActiva = {
    id: 'area-uuid-1',
    nombre: 'Sistemas',
    activo: true,
    deleted_at: null
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrearCargoUseCase,
        {provide: PrismaService, useValue: mockPrismaService}
      ]
    }).compile();

    useCase = module.get<CrearCargoUseCase>(CrearCargoUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    // Mock del generador de IDs para tener un resultado determinístico
    jest
      .spyOn(IdentityGenerator, 'generateId')
      .mockReturnValue('generated-uuid-123');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Validación del área', () => {
    it('debe lanzar NotFoundException si el área no existe', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(null);

      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);

      expect(prisma.area.findUnique).toHaveBeenCalledWith({
        where: { id: payload.id_area },
      });
      // No debe continuar el flujo hacia la búsqueda/creación del cargo
      expect(prisma.cargo.findFirst).not.toHaveBeenCalled();
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el área está inactiva', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue({
        ...areaActiva,
        activo: false,
      });

      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el área está eliminada (soft delete)', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue({
        ...areaActiva,
        deleted_at: new Date(),
      });

      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });
  });

  describe('Validación de cargo duplicado', () => {
    it('debe lanzar BadRequestException si ya existe un cargo con el mismo nombre en el área', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue({
        id: 'cargo-existente-id',
        nombre: payload.nombre,
        id_area: payload.id_area,
      });

      await expect(useCase.execute(payload)).rejects.toThrow(
        BadRequestException,
      );

      expect(prisma.cargo.findFirst).toHaveBeenCalledWith({
        where: {
          nombre: payload.nombre,
          id_area: payload.id_area,
        },
      });
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });
  });

  describe('Creación exitosa', () => {
    it('debe crear el cargo correctamente cuando el área es válida y no hay duplicados', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);

      const cargoCreado = {
        id: 'generated-uuid-123',
        id_area: payload.id_area,
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        activo: true,
      };
      mockPrismaService.cargo.create.mockResolvedValue(cargoCreado);

      const result = await useCase.execute(payload);

      expect(result).toEqual(cargoCreado);
      expect(prisma.cargo.create).toHaveBeenCalledWith({
        data: {
          id: 'generated-uuid-123',
          id_area: payload.id_area,
          nombre: payload.nombre,
          descripcion: payload.descripcion,
          activo: true,
        },
      });
    });
  });

  describe('Manejo de errores inesperados', () => {
    it('debe envolver un error inesperado de Prisma en BadRequestException', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);
      mockPrismaService.cargo.create.mockRejectedValue(
        new Error('Conexión a la base de datos perdida'),
      );

      await expect(useCase.execute(payload)).rejects.toThrow(
        BadRequestException,
      );
      await expect(useCase.execute(payload)).rejects.toMatchObject({
        response: {
          title: 'Error al crear el Cargo',
        },
      });
    });

    it('debe propagar la NotFoundException tal cual, sin envolverla en BadRequestException genérico', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(null);

      await expect(useCase.execute(payload)).rejects.toMatchObject({
        response: {
          title: 'Área inválida',
        },
      });
    });

    it('debe propagar la BadRequestException de cargo duplicado tal cual', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'x' });

      await expect(useCase.execute(payload)).rejects.toMatchObject({
        response: {
          title: 'Cargo duplicado',
        },
      });
    });
  });
});
