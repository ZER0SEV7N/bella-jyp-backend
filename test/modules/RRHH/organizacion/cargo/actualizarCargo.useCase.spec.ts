//test/modules/RRHH/organizacion/cargo/actualizarCargo.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ActualizarCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/actualizarCargo.useCase';
import type { ActualizarCargoDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el caso de uso ActualizarCargoUseCase, que maneja la actualización de cargos en el módulo de RRHH.
 * Se simula el comportamiento del servicio Prisma para verificar la lógica de negocio y las excepciones lanzadas en diferentes escenarios.
 * Se incluyen pruebas para actualizaciones parciales, transferencia de área, bandas salariales, detección de nombres duplicados y resiliencia ante fallos de base de datos.
 */
describe('ActualizarCargoUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: ActualizarCargoUseCase;
  let prisma: PrismaService;

  // Mocks de Prisma para simular la interacción con la base de datos
  const mockPrisma = {
    cargo: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    area: { findUnique: jest.fn() },
  };

  // Datos de prueba para un cargo existente en la base de datos
  const idCargo = 'cargo-uuid-100';
  const cargoActual = {
    id: idCargo,
    id_area: 'area-uuid-1',
    nombre: 'Analista Contable',
    descripcion: 'Gestión de libros contables',
    sueldo_minimo: 1500.0,
    sueldo_maximo: 3500.0,
    activo: true,
    deleted_at: null,
  };

  // Configuración inicial antes de cada prueba
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActualizarCargoUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<ActualizarCargoUseCase>(ActualizarCargoUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // Pruebas para actualizaciones parciales y modificación de atributos básicos
  describe('Actualizaciones Parciales y Modificación de Atributos Básicos', () => {
    it('Happy Path: Debe actualizar nombre y descripción sin modificar área ni bandas salariales', async () => {
      //Arrange: Simular que el cargo existe en BD y que no hay duplicados
      const payload: ActualizarCargoDto = {
        nombre: 'Analista Contable Senior',
        descripcion: 'Gestión y auditoría de libros electrónicos PLAME',
      };

      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.cargo.findFirst.mockResolvedValue(null);
      mockPrisma.cargo.update.mockResolvedValue({ ...cargoActual, ...payload });

      // Act: Ejecutar el use case para actualizar el cargo
      const resultado = await useCase.execute(idCargo, payload);

      expect(resultado.nombre).toBe('Analista Contable Senior');
      expect(mockPrisma.area.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.cargo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: idCargo },
          data: expect.objectContaining({
            nombre: 'Analista Contable Senior',
            descripcion: 'Gestión y auditoría de libros electrónicos PLAME',
          }),
        }),
      );
    });

    it('Happy Path: Debe actualizar la banda salarial correctamente cuando el sueldo máximo es mayor o igual al mínimo', async () => {
      // Arrange: Simular actualización de bandas salariales válidas
      const payload: ActualizarCargoDto = {
        sueldo_minimo: 2000.0,
        sueldo_maximo: 4500.0,
      };

      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.cargo.findFirst.mockResolvedValue(null);
      mockPrisma.cargo.update.mockResolvedValue({ ...cargoActual, ...payload });

      // Act
      const resultado = await useCase.execute(idCargo, payload);

      // Assert
      expect(mockPrisma.cargo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: idCargo },
          data: expect.objectContaining({
            sueldo_minimo: 2000.0,
            sueldo_maximo: 4500.0,
          }),
        }),
      );
      expect(resultado.sueldo_minimo).toBe(2000.0);
    });

    it('Debe lanzar NotFoundException si el cargo no existe o fue deshabilitado por Soft Delete', async () => {
      // Arrange: Simular que el cargo no existe en la base de datos
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      // Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.execute(idCargo, { nombre: 'Nuevo Nombre' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });
  });

  describe('Validación de Bandas Salariales', () => {
    it('Debe lanzar BadRequestException si el nuevo sueldo_maximo es menor al sueldo_minimo enviado', async () => {
      // Arrange
      const payload: ActualizarCargoDto = {
        sueldo_minimo: 3000.0,
        sueldo_maximo: 2500.0, // Inconsistente
      };

      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.cargo.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(idCargo, payload)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar BadRequestException si el nuevo sueldo_maximo es menor al sueldo_minimo existente en BD', async () => {
      // Arrange: cargoActual tiene sueldo_minimo: 1500.0
      const payload: ActualizarCargoDto = {
        sueldo_maximo: 1200.0, // Menor que los 1500.0 actuales
      };

      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.cargo.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(idCargo, payload)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });
  });

  describe('Transferencia de Área', () => {
    it('Debe validar que el área de destino exista y esté activa al transferir el cargo', async () => {
      // Arrange: Simular que el cargo existe en BD y que el área de destino no está activa
      const payload: ActualizarCargoDto = { id_area: 'area-destino-uuid' };

      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.area.findUnique.mockResolvedValue({
        id: 'area-destino-uuid',
        activo: false, // Inactiva
        deleted_at: null,
      });

      // Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.execute(idCargo, payload)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe permitir transferir el cargo si el área de destino existe y se encuentra activa', async () => {
      const payload: ActualizarCargoDto = { id_area: 'area-destino-valida' };

      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.area.findUnique.mockResolvedValue({
        id: 'area-destino-valida',
        activo: true,
        deleted_at: null,
      });
      mockPrisma.cargo.findFirst.mockResolvedValue(null);
      mockPrisma.cargo.update.mockResolvedValue({ ...cargoActual, id_area: 'area-destino-valida' });

      const resultado = await useCase.execute(idCargo, payload);

      expect(mockPrisma.cargo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id_area: 'area-destino-valida' }),
        }),
      );
      expect(resultado.id_area).toBe('area-destino-valida');
    });
  });

  describe('Detección de Nombres Duplicados y Resiliencia', () => {
    it('Debe lanzar BadRequestException si el nuevo nombre colisiona con otro cargo existente en la misma área', async () => {
      // Arrange: Simular que el cargo existe en BD y que hay otro cargo con el mismo nombre en la misma área
      const payload: ActualizarCargoDto = { nombre: 'Jefe de Operaciones' };

      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.cargo.findFirst.mockResolvedValue({
        id: 'otro-cargo-uuid',
        nombre: 'Jefe de Operaciones',
        id_area: cargoActual.id_area,
      });

      // Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.execute(idCargo, payload)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe transformar fallos inesperados de BD a InternalServerErrorException', async () => {
      // Arrange: Simular que el cargo existe en BD pero la actualización falla por un error de conexión
      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.cargo.findFirst.mockResolvedValue(null);
      mockPrisma.cargo.update.mockRejectedValue(new Error('Fallo de conexión en BD'));

      // Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.execute(idCargo, { descripcion: 'Nueva desc' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});