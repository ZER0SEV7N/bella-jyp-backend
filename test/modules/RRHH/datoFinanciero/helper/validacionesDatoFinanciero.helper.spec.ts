//test/modules/RRHH/datoFinanciero/helper/validacionesDatoFinanciero.helper.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { validarSueldoCargo } from '@/modules/RRHH/datoFinanciero/use-case/helper/validacionesDatoFinanciero.helper';

/**
 * Pruebas unitarias para validarSueldoCargo en validacionesDatoFinanciero.helper.ts.
 */
describe('validarSueldoCargo - Pruebas Unitarias de Rango Salarial', () => {
  const mockPrisma = {
    cargo: {
      findFirst: jest.fn(),
    },
  };

  const idCargo = 'cargo-uuid-1';

  afterEach(() => jest.clearAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe permitir un sueldo igual al mínimo del cargo', async () => {
      mockPrisma.cargo.findFirst.mockResolvedValue({
        sueldo_minimo: new Prisma.Decimal(1130),
        sueldo_maximo: new Prisma.Decimal(3000),
      });

      await expect(
        validarSueldoCargo(
          mockPrisma as unknown as PrismaService,
          idCargo,
          1130
        )
      ).resolves.toBeUndefined();
    });

    it('Debe permitir un sueldo igual al máximo del cargo', async () => {
      mockPrisma.cargo.findFirst.mockResolvedValue({
        sueldo_minimo: new Prisma.Decimal(1130),
        sueldo_maximo: new Prisma.Decimal(3000),
      });

      await expect(
        validarSueldoCargo(
          mockPrisma as unknown as PrismaService,
          idCargo,
          3000
        )
      ).resolves.toBeUndefined();
    });

    it('Debe permitir cualquier sueldo sobre el mínimo cuando no hay máximo definido', async () => {
      mockPrisma.cargo.findFirst.mockResolvedValue({
        sueldo_minimo: new Prisma.Decimal(1130),
        sueldo_maximo: null,
      });

      await expect(
        validarSueldoCargo(
          mockPrisma as unknown as PrismaService,
          idCargo,
          25000
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe rechazar con BadRequestException cuando el sueldo está por debajo del mínimo', async () => {
      mockPrisma.cargo.findFirst.mockResolvedValue({
        sueldo_minimo: new Prisma.Decimal(1130),
        sueldo_maximo: new Prisma.Decimal(3000),
      });

      await expect(
        validarSueldoCargo(
          mockPrisma as unknown as PrismaService,
          idCargo,
          1000
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Debe rechazar con BadRequestException cuando el sueldo está por encima del máximo', async () => {
      mockPrisma.cargo.findFirst.mockResolvedValue({
        sueldo_minimo: new Prisma.Decimal(1130),
        sueldo_maximo: new Prisma.Decimal(3000),
      });

      await expect(
        validarSueldoCargo(
          mockPrisma as unknown as PrismaService,
          idCargo,
          3500
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Debe indicar el mínimo cuando el sueldo está por debajo y no hay máximo', async () => {
      mockPrisma.cargo.findFirst.mockResolvedValue({
        sueldo_minimo: new Prisma.Decimal(1130),
        sueldo_maximo: null,
      });

      let capturado: unknown;
      try {
        await validarSueldoCargo(
          mockPrisma as unknown as PrismaService,
          idCargo,
          900
        );
      } catch (error) {
        capturado = error;
      }

      expect(capturado).toBeInstanceOf(BadRequestException);
      expect((capturado as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          detail: 'El sueldo debe ser al menos S/ 1130 para este cargo.',
          campo: 'sueldo_basico',
        })
      );
    });

    it('Debe lanzar BadRequestException si el sueldo no es mayor a 0', async () => {
      await expect(
        validarSueldoCargo(mockPrisma as unknown as PrismaService, idCargo, 0)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.cargo.findFirst).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el cargo no existe o está inactivo', async () => {
      mockPrisma.cargo.findFirst.mockResolvedValue(null);

      await expect(
        validarSueldoCargo(
          mockPrisma as unknown as PrismaService,
          idCargo,
          2000
        )
      ).rejects.toThrow(NotFoundException);
    });
  });
});
