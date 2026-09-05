import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  obtenerCargo,
  validarAreaActiva,
  validarNombreUnico,
  validarBandaSalarial,
  resolverSueldo,
} from '@/modules/RRHH/organizacion/use-cases/cargos/helpers/validaciones.helper';

describe('ValidacionesHelper - Pruebas Unitarias Exhaustivas', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      cargo: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      area: {
        findUnique: jest.fn(),
      },
    };
  });

  afterEach(() => jest.clearAllMocks());

  describe('obtenerCargo()', () => {
    it('Debe retornar el cargo si existe y está activo', async () => {
      const cargoMock = { id: 'cargo-1', nombre: 'Contador', deleted_at: null };
      mockPrisma.cargo.findUnique.mockResolvedValue(cargoMock);

      const result = await obtenerCargo(mockPrisma as PrismaService, 'cargo-1');

      expect(result).toEqual(cargoMock);
      expect(mockPrisma.cargo.findUnique).toHaveBeenCalledWith({
        where: { id: 'cargo-1', deleted_at: null },
      });
    });

    it('Debe lanzar NotFoundException si el cargo es null o no existe', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      await expect(obtenerCargo(mockPrisma as PrismaService, 'cargo-invalido')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validarAreaActiva()', () => {
    it('Debe resolver sin consultar BD si idArea no se envía', async () => {
      await expect(validarAreaActiva(mockPrisma as PrismaService, undefined)).resolves.toBeUndefined();
      expect(mockPrisma.area.findUnique).not.toHaveBeenCalled();
    });

    it('Debe resolver sin consultar BD si idArea coincide con idAreaActual (sin cambio de área)', async () => {
      await expect(
        validarAreaActiva(mockPrisma as PrismaService, 'area-1', 'area-1'),
      ).resolves.toBeUndefined();
      expect(mockPrisma.area.findUnique).not.toHaveBeenCalled();
    });

    it('Debe resolver si el área destino existe y está activa', async () => {
      mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-2', activo: true, deleted_at: null });

      await expect(
        validarAreaActiva(mockPrisma as PrismaService, 'area-2', 'area-1'),
      ).resolves.toBeUndefined();
      expect(mockPrisma.area.findUnique).toHaveBeenCalledWith({
        where: { id: 'area-2', deleted_at: null },
      });
    });

    it('Debe lanzar NotFoundException si el área destino no existe o está inactiva', async () => {
      mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-2', activo: false });

      await expect(
        validarAreaActiva(mockPrisma as PrismaService, 'area-2', 'area-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validarNombreUnico()', () => {
    it('Debe resolver si no existe colisión de nombres en el área', async () => {
      mockPrisma.cargo.findFirst.mockResolvedValue(null);

      await expect(
        validarNombreUnico(mockPrisma as PrismaService, 'Nuevo Cargo', 'area-1'),
      ).resolves.toBeUndefined();

      expect(mockPrisma.cargo.findFirst).toHaveBeenCalledWith({
        where: {
          nombre: { equals: 'Nuevo Cargo', mode: 'insensitive' },
          id_area: 'area-1',
          deleted_at: null,
        },
      });
    });

    it('Debe excluir el ID del cargo si se envía idCargoExcluir (caso actualización)', async () => {
      mockPrisma.cargo.findFirst.mockResolvedValue(null);

      await expect(
        validarNombreUnico(mockPrisma as PrismaService, 'Nuevo Cargo', 'area-1', 'cargo-100'),
      ).resolves.toBeUndefined();

      expect(mockPrisma.cargo.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 'cargo-100' },
          }),
        }),
      );
    });

    it('Debe lanzar BadRequestException si ya existe un cargo con el mismo nombre', async () => {
      mockPrisma.cargo.findFirst.mockResolvedValue({ id: 'cargo-colision' });

      await expect(
        validarNombreUnico(mockPrisma as PrismaService, 'Nombre Duplicado', 'area-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validarBandaSalarial()', () => {
    it('Debe resolver si el sueldo máximo es mayor o igual al mínimo', () => {
      expect(() => validarBandaSalarial(1500, 3000)).not.toThrow();
      expect(() => validarBandaSalarial(2000, 2000)).not.toThrow();
    });

    it('Debe resolver si alguno de los sueldos es nulo o indefinido', () => {
      expect(() => validarBandaSalarial(null, 3000)).not.toThrow();
      expect(() => validarBandaSalarial(1500, null)).not.toThrow();
      expect(() => validarBandaSalarial(null, null)).not.toThrow();
    });

    it('Debe lanzar BadRequestException de forma síncrona si el sueldo máximo es menor al mínimo', () => {
      expect(() => validarBandaSalarial(3500, 2000)).toThrow(BadRequestException);
    });
  });

  describe('resolverSueldo()', () => {
    it('Debe priorizar el valor provisto en payloadValue si está definido', () => {
      expect(resolverSueldo(2500, 1800)).toBe(2500);
      expect(resolverSueldo(0, 1800)).toBe(0);
    });

    it('Debe retornar el valor numérico de BD si payloadValue es undefined', () => {
      expect(resolverSueldo(undefined, '1800.50')).toBe(1800.5);
      expect(resolverSueldo(undefined, 1800)).toBe(1800);
    });

    it('Debe retornar null para currentValue null y NaN si ambos valores son undefined', () => {
      expect(resolverSueldo(undefined, null)).toBeNull();
      expect(resolverSueldo(undefined, undefined)).toBeNaN();
    });
  });
});