import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { CrearCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/crearCargo.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearCargoDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el caso de uso CrearCargoUseCase.
 * Se cubren los siguientes escenarios:
 * 1. Validación del área asignada: existencia, estado activo y baja lógica.
 * 2. Validación de bandas salariales: consistencia entre mínimo y máximo.
 * 3. Validación de nombre duplicado: unicidad por área (case-insensitive).
 * 4. Creación exitosa del cargo: happy path con valores por defecto y personalizados.
 */
describe('CrearCargoUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: CrearCargoUseCase;
  let prisma: PrismaService;

  const mockPrismaService = {
    area: { findUnique: jest.fn() },
    cargo: { findFirst: jest.fn(), create: jest.fn() },
  };

  const areaActiva = {
    id: 'area-uuid-1',
    nombre: 'Sistemas',
    activo: true,
    deleted_at: null,
  };

  const payload: CrearCargoDto = {
    id_area: 'area-uuid-1',
    nombre: 'Analista de Sistemas Senior',
    descripcion: 'Encargado de soporte y desarrollo',
    sueldo_minimo: 1800.0,
    sueldo_maximo: 4000.0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrearCargoUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    useCase = module.get<CrearCargoUseCase>(CrearCargoUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    jest.spyOn(IdentityGenerator, 'generateId').mockReturnValue('generated-uuid-123');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Validación del Área Asignada', () => {
    it('Debe lanzar NotFoundException si el área especificada no existe', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(null);

      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);
      expect(prisma.area.findUnique).toHaveBeenCalledWith({
        where: { id: payload.id_area, deleted_at: null },
      });
      expect(prisma.cargo.findFirst).not.toHaveBeenCalled();
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el área se encuentra inactiva', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue({ ...areaActiva, activo: false });

      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });
  });

  describe('Validación de Banda Salarial', () => {
    it('Debe lanzar BadRequestException si el sueldo máximo es menor al sueldo mínimo', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);

      const payloadInconsistente: CrearCargoDto = {
        ...payload,
        sueldo_minimo: 3500.0,
        sueldo_maximo: 2000.0,
      };

      await expect(useCase.execute(payloadInconsistente)).rejects.toThrow(BadRequestException);
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });
  });

  describe('Validación de Nombre Duplicado y Creación Exitosa', () => {
    it('Debe lanzar BadRequestException si ya existe un cargo con el mismo nombre en el área', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue({
        id: 'cargo-existente-id',
        nombre: 'Analista de Sistemas Senior',
        id_area: payload.id_area,
      });

      await expect(useCase.execute(payload)).rejects.toThrow(BadRequestException);
      expect(prisma.cargo.findFirst).toHaveBeenCalledWith({
        where: {
          nombre: { equals: payload.nombre.trim(), mode: 'insensitive' },
          id_area: payload.id_area,
          deleted_at: null,
        },
      });
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });

    it('Happy Path: Debe crear el cargo vinculando área y bandas salariales con éxito', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);

      const cargoCreadoEsperado = {
        id: 'generated-uuid-123',
        id_area: payload.id_area,
        nombre: payload.nombre.trim(),
        descripcion: payload.descripcion,
        sueldo_minimo: 1800.0,
        sueldo_maximo: 4000.0,
        activo: true,
        area: { id: areaActiva.id, nombre: areaActiva.nombre },
      };

      mockPrismaService.cargo.create.mockResolvedValue(cargoCreadoEsperado);

      const result = await useCase.execute(payload);

      expect(result).toEqual(cargoCreadoEsperado);
      expect(prisma.cargo.create).toHaveBeenCalledWith({
        data: {
          id: 'generated-uuid-123',
          id_area: payload.id_area,
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion,
          sueldo_minimo: 1800.0,
          sueldo_maximo: 4000.0,
          activo: true,
        },
        include: {
          area: { select: { id: true, nombre: true } },
        },
      });
    });

    it('Happy Path: Debe aplicar sueldo_minimo por defecto (1130.00) si no se especifica', async () => {
      const payloadMinimo: CrearCargoDto = {
        id_area: 'area-uuid-1',
        nombre: 'Practicante Pre Profesional',
      };

      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);
      mockPrismaService.cargo.create.mockResolvedValue({
        id: 'generated-uuid-123',
        ...payloadMinimo,
        sueldo_minimo: 1130.0,
        sueldo_maximo: null,
        activo: true,
      });

      const result = await useCase.execute(payloadMinimo);

      expect(prisma.cargo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sueldo_minimo: 1130.0,
            sueldo_maximo: null,
          }),
        }),
      );
      expect(result.sueldo_minimo).toBe(1130.0);
    });
  });

  describe('Manejo de Errores Inesperados', () => {
    it('Debe capturar errores del motor de base de datos y lanzar InternalServerErrorException', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);
      mockPrismaService.cargo.create.mockRejectedValue(new Error('Deadlock en PostgreSQL'));

      await expect(useCase.execute(payload)).rejects.toThrow(InternalServerErrorException);
    });
  });
});