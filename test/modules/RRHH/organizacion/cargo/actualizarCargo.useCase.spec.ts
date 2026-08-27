//test/modules/RRHH/organizacion/cargo/actualizarCargo.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ActualizarCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/actualizarCargo.useCase';
import type { ActualizarCargoDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el caso de uso ActualizarCargoUseCase, que maneja la actualización de cargos en el módulo de RRHH.
 * Se simula el comportamiento del servicio Prisma para verificar la lógica de negocio y las excepciones lanzadas en diferentes escenarios.
 * Se incluyen pruebas para actualizaciones parciales, transferencia de área, asignación de jornada sugerida, detección de nombres duplicados y resiliencia ante fallos de base de datos.
 */
describe('ActualizarCargoUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: ActualizarCargoUseCase;
  let prisma: PrismaService;

  //Mocks de Prisma para simular la interacción con la base de datos
  const mockPrisma = {
    cargo: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    area: { findUnique: jest.fn() },
    jornada: { findUnique: jest.fn() }
  };

  //Datos de prueba para un cargo existente en la base de datos
  const idCargo = 'cargo-uuid-100';
  const cargoActual = {
    id: idCargo,
    id_area: 'area-uuid-1',
    jornada_sugerida_id: 'jornada-uuid-1',
    nombre: 'Analista Contable',
    descripcion: 'Gestión de libros contables',
    activo: true,
    deleted_at: null
  };

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActualizarCargoUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<ActualizarCargoUseCase>(ActualizarCargoUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  //Pruebas para actualizaciones parciales y modificación de atributos básicos
  describe('Actualizaciones Parciales y Modificación de Atributos Básicos', () => {
    it('Happy Path: Debe actualizar nombre y descripción sin modificar área ni jornada sugerida', async () => {
      //Arrange: Simular que el cargo existe en BD y que no hay duplicados
      const payload: ActualizarCargoDto = {
        nombre: 'Analista Contable Senior',
        descripcion: 'Gestión y auditoría de libros electrónicos PLAME'
      };

      //Simular la respuesta de Prisma al buscar el cargo existente
      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.cargo.findFirst.mockResolvedValue(null);
      mockPrisma.cargo.update.mockResolvedValue({ ...cargoActual, ...payload });

      //Act: Ejecutar la use case para actualizar el cargo
      const resultado = await useCase.execute(idCargo, payload);

      expect(resultado.nombre).toBe('Analista Contable Senior');
      expect(mockPrisma.area.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.cargo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: idCargo },
          data: expect.objectContaining({nombre: 'Analista Contable Senior', descripcion: 'Gestión y auditoría de libros electrónicos PLAME'})
        })
      );
    });

    it('Debe lanzar NotFoundException si el cargo no existe o fue deshabilitado por Soft Delete', async () => {
      //Arrange: Simular que el cargo no existe en la base de datos
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.execute(idCargo, { nombre: 'Nuevo Nombre' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });
  });

  describe('Transferencia de Área y Asignación de Jornada Sugerida', () => {
    it('Debe validar que el área de destino exista y esté activa al transferir el cargo', async () => {
      //Arrange: Simular que el cargo existe en BD y que el área de destino no está activa
      const payload: ActualizarCargoDto = { id_area: 'area-destino-uuid' };

      //Simular la respuesta de Prisma al buscar el cargo existente y el área de destino
      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.area.findUnique.mockResolvedValue({
        id: 'area-destino-uuid',
        activo: false, // Inactiva
        deleted_at: null,
      });

      //Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.execute(idCargo, payload)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe validar que la nueva jornada sugerida exista y esté activa', async () => {
      //Arrange: Simular que el cargo existe en BD y que la jornada sugerida no existe
      const payload: ActualizarCargoDto = { jornada_sugerida_id: 'nueva-jornada-uuid' };

      //Simular la respuesta de Prisma al buscar el cargo existente
      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.jornada.findUnique.mockResolvedValue(null); //No existe

      //Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.execute(idCargo, payload)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe permitir desvincular la jornada sugerida enviando null', async () => {
      //Arrange: Simular que el cargo existe en BD y que se desea desvincular la jornada sugerida
      const payload: ActualizarCargoDto = { jornada_sugerida_id: null };

      //Simular la respuesta de Prisma al buscar el cargo existente
      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.cargo.update.mockResolvedValue({ ...cargoActual, jornada_sugerida_id: null });

      //Act: Ejecutar la use case para desvincular la jornada sugerida
      const resultado = await useCase.execute(idCargo, payload);

      //Assert: Verificar que la jornada sugerida fue desvinculada correctamente y que se realizaron las llamadas esperadas a Prisma
      expect(mockPrisma.jornada.findUnique).not.toHaveBeenCalled();
      expect(resultado.jornada_sugerida_id).toBeNull();
    });
  });

  describe('Detección de Nombres Duplicados y Resiliencia', () => {
    it('Debe lanzar BadRequestException si el nuevo nombre colisiona con otro cargo existente en la misma área', async () => {
      //Arrange: Simular que el cargo existe en BD y que hay otro cargo con el mismo nombre en la misma área
      const payload: ActualizarCargoDto = { nombre: 'Jefe de Operaciones' };

      //Simular la respuesta de Prisma al buscar el cargo existente y otro cargo con el mismo nombre
      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.cargo.findFirst.mockResolvedValue({
        id: 'otro-cargo-uuid',
        nombre: 'Jefe de Operaciones',
        id_area: cargoActual.id_area
      });

      //Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.execute(idCargo, payload)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.cargo.update).not.toHaveBeenCalled();
    });

    it('Debe transformar fallos inesperados de BD a InternalServerErrorException', async () => {
      //Arrange: Simular que el cargo existe en BD pero la actualización falla por un error de conexión
      mockPrisma.cargo.findUnique.mockResolvedValue(cargoActual);
      mockPrisma.cargo.update.mockRejectedValue(new Error('Fallo de conexión en BD'));

      //Act & Assert: Ejecutar la use case y verificar que se lance la excepción
      await expect(useCase.execute(idCargo, { descripcion: 'Nueva desc' })).rejects.toThrow(InternalServerErrorException);
    });
  });
});