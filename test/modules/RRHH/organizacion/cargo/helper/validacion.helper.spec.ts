//test/modules/RRHH/organizacion/cargo/helper/validacion.helper.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  obtenerCargo,
  validarNombreCargoUnico,
  validarBandaSalarial,
  resolverSueldo,
} from '@/modules/RRHH/organizacion/use-cases/cargos/helpers/validaciones.helper';

/**
 * Pruebas unitarias exhaustivas para las funciones de validación en el módulo de cargos del sistema de RRHH.
 * Estas pruebas verifican el comportamiento de las funciones de validación en escenarios de éxito y manejo de errores.
 * Se simula la interacción con la base de datos utilizando un mock del servicio Prisma.
 */
describe('ValidacionesHelper Cargos - Pruebas Unitarias Exhaustivas', () => {
  let mockPrisma: any;

  // Configuración del mock de Prisma antes de cada test
  beforeEach(() => {
    mockPrisma = {
      cargo: { findUnique: jest.fn(), findFirst: jest.fn() },
    };
  });

  afterEach(() => jest.clearAllMocks());

  // =========================================================================
  // 1. obtenerCargo
  // =========================================================================
  describe('obtenerCargo()', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe retornar el cargo si existe y está activo', async () => {
        // Arrange: Simular que el cargo existe y está activo
        const cargoMock = { id: 'cargo-1', nombre: 'Contador', deleted_at: null };
        mockPrisma.cargo.findUnique.mockResolvedValue(cargoMock);

        // Act: Llamar a la función obtenerCargo con el mock de Prisma
        const result = await obtenerCargo(mockPrisma as PrismaService, 'cargo-1');

        // Assert: Verificar que el resultado sea el cargo esperado y que se haya llamado a la función findUnique con los parámetros correctos
        expect(result).toEqual(cargoMock);
        expect(mockPrisma.cargo.findUnique).toHaveBeenCalledWith({
          where: { id: 'cargo-1', deleted_at: null },
        });
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar NotFoundException si el cargo es null o no existe', async () => {
        // Arrange: Simular que el cargo no existe (findUnique retorna null)
        mockPrisma.cargo.findUnique.mockResolvedValue(null);

        // Act & Assert: Verificar que la función obtenerCargo lance NotFoundException al no encontrar el cargo
        await expect(obtenerCargo(mockPrisma as PrismaService, 'cargo-invalido')).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });

  // =========================================================================
  // 2. validarNombreCargoUnico
  // =========================================================================
  describe('validarNombreCargoUnico()', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe resolver si no existe colisión de nombres en el área', async () => {
        // Arrange: Simular que no existe otro cargo con el mismo nombre en la misma área
        mockPrisma.cargo.findFirst.mockResolvedValue(null);

        // Act: Llamar a la función validarNombreCargoUnico y verificar que no se lance ninguna excepción
        await expect(
          validarNombreCargoUnico(mockPrisma as PrismaService, 'Nuevo Cargo', 'area-1'),
        ).resolves.toBeUndefined();

        // Assert: Verificar que se llamó a la función findFirst con los parámetros correctos para buscar colisiones de nombres
        expect(mockPrisma.cargo.findFirst).toHaveBeenCalledWith({
          where: {
            nombre: { equals: 'Nuevo Cargo', mode: 'insensitive' },
            id_area: 'area-1',
            deleted_at: null,
          },
          select: { id: true },
        });
      });

      it('Debe excluir el ID del cargo si se envía idCargoExcluir (caso actualización)', async () => {
        // Arrange: Simular que no existe otro cargo con el mismo nombre en la misma área, excluyendo el cargo actual
        mockPrisma.cargo.findFirst.mockResolvedValue(null);

        // Act: Llamar a la función validarNombreCargoUnico con idCargoExcluir y verificar que no se lance ninguna excepción
        await expect(
          validarNombreCargoUnico(mockPrisma as PrismaService, 'Nuevo Cargo', 'area-1', 'cargo-100'),
        ).resolves.toBeUndefined();

        // Assert: Verificar que se llamó a la función findFirst con los parámetros correctos, incluyendo la exclusión del cargo actual
        expect(mockPrisma.cargo.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              id: { not: 'cargo-100' },
              id_area: 'area-1',
            }),
          }),
        );
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar BadRequestException si ya existe un cargo con el mismo nombre', async () => {
        // Arrange: Simular que ya existe otro cargo con el mismo nombre en la misma área
        mockPrisma.cargo.findFirst.mockResolvedValue({ id: 'cargo-colision' });

        // Act & Assert: Verificar que la función validarNombreCargoUnico lance BadRequestException al encontrar una colisión de nombres
        await expect(
          validarNombreCargoUnico(mockPrisma as PrismaService, 'Nombre Duplicado', 'area-1'),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // =========================================================================
  // 3. validarBandaSalarial
  // =========================================================================
  describe('validarBandaSalarial()', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe resolver si el sueldo máximo es mayor o igual al mínimo', () => {
        // Act & Assert: Verificar que la función validarBandaSalarial no lance ninguna excepción si el sueldo máximo es mayor o igual al mínimo
        expect(() => validarBandaSalarial(1500, 3000)).not.toThrow();
        expect(() => validarBandaSalarial(2000, 2000)).not.toThrow();
      });

      it('Debe resolver si alguno de los sueldos es nulo o indefinido', () => {
        // Act & Assert: Verificar que la función validarBandaSalarial no lance ninguna excepción si alguno de los sueldos es nulo o indefinido
        expect(() => validarBandaSalarial(null, 3000)).not.toThrow();
        expect(() => validarBandaSalarial(1500, null)).not.toThrow();
        expect(() => validarBandaSalarial(null, null)).not.toThrow();
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar BadRequestException de forma síncrona si el sueldo máximo es menor al mínimo', () => {
        // Act & Assert: Verificar que la función validarBandaSalarial lance BadRequestException si el sueldo máximo es menor al mínimo
        expect(() => validarBandaSalarial(3500, 2000)).toThrow(BadRequestException);
      });
    });
  });

  // =========================================================================
  // 4. resolverSueldo
  // =========================================================================
  describe('resolverSueldo()', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe priorizar el valor provisto en payloadValue si está definido', () => {
        // Act & Assert: Verificar que la función resolverSueldo retorne el valor de payloadValue si está definido
        expect(resolverSueldo(2500, 1800)).toBe(2500);
        expect(resolverSueldo(0, 1800)).toBe(0);
      });

      it('Debe retornar el valor numérico de BD si payloadValue es undefined', () => {
        // Act & Assert: Verificar que la función resolverSueldo retorne el valor de currentValue si payloadValue es undefined
        expect(resolverSueldo(undefined, '1800.50')).toBe(1800.5);
        expect(resolverSueldo(undefined, 1800)).toBe(1800);
      });

      it('Debe retornar null para currentValue null o undefined cuando payloadValue es undefined', () => {
        // Act & Assert: Verificar que la función resolverSueldo retorne null si ambos valores no representan número
        expect(resolverSueldo(undefined, null)).toBeNull();
        expect(resolverSueldo(undefined, undefined)).toBeNull();
      });
    });
  });
});