//test/modules/RRHH/organizacion/cargo/crearCargo.useCase.spec.ts
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

  //Mock del servicio Prisma para simular la interacción con la base de datos
  const mockPrismaService = {
    area: { findUnique: jest.fn() },
    cargo: { findFirst: jest.fn(), create: jest.fn() },
  };

  //Datos de prueba para un área activa
  const areaActiva = {
    id: 'area-uuid-1',
    nombre: 'Sistemas',
    activo: true,
    deleted_at: null,
  };

  //Payload de prueba para crear un cargo
  const payload: CrearCargoDto = {
    id_area: 'area-uuid-1',
    nombre: 'Analista de Sistemas Senior',
    descripcion: 'Encargado de soporte y desarrollo',
    sueldo_minimo: 1800.0,
    sueldo_maximo: 4000.0,
  };

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrearCargoUseCase,
        { provide: PrismaService, useValue: mockPrismaService }
      ]
    }).compile();

    useCase = module.get<CrearCargoUseCase>(CrearCargoUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    jest.spyOn(IdentityGenerator, 'generateId').mockReturnValue('generated-uuid-123');
  });

  //Limpiar mocks después de cada test para evitar contaminación entre pruebas
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Validación del Área Asignada', () => {
    it('Debe lanzar NotFoundException si el área especificada no existe', async () => {
      //Arrange: Simular que el área no existe en la base de datos
      mockPrismaService.area.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance NotFoundException
      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);
      expect(prisma.area.findUnique).toHaveBeenCalledWith({ where: { id: payload.id_area, deleted_at: null } });
      expect(prisma.cargo.findFirst).not.toHaveBeenCalled();
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el área se encuentra inactiva', async () => {
      //Arrange: Simular que el área existe pero está inactiva (activo=false)
      mockPrismaService.area.findUnique.mockResolvedValue({ ...areaActiva, activo: false });

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance NotFoundException
      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });
  });

  describe('Validación de Banda Salarial', () => {
    it('Debe lanzar BadRequestException si el sueldo máximo es menor al sueldo mínimo', async () => {
      //Arrange: Simular que el área existe y está activa
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);

      //Payload con sueldo máximo menor al mínimo
      const payloadInconsistente: CrearCargoDto = {
        ...payload,
        sueldo_minimo: 3500.0,
        sueldo_maximo: 2000.0
      };

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance BadRequestException
      await expect(useCase.execute(payloadInconsistente)).rejects.toThrow(BadRequestException);
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });
  });

  describe('Validación de Nombre Duplicado y Creación Exitosa', () => {
    it('Debe lanzar BadRequestException si ya existe un cargo con el mismo nombre en el área', async () => {
      //Arrange: Simular que el área existe y está activa, y que ya existe un cargo con el mismo nombre (case-insensitive)
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue({
        id: 'cargo-existente-id',
        nombre: 'Analista de Sistemas Senior',
        id_area: payload.id_area
      });

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance BadRequestException
      await expect(useCase.execute(payload)).rejects.toThrow(BadRequestException);
      expect(prisma.cargo.findFirst).toHaveBeenCalledWith({
        where: {
          nombre: { equals: payload.nombre.trim(), mode: 'insensitive' },
          id_area: payload.id_area,
          deleted_at: null
        }
      });
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });

    it('Happy Path: Debe crear el cargo vinculando área y bandas salariales con éxito', async () => {
      //Arrange: Simular que el área existe y está activa, y que no existe un cargo con el mismo nombre
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);

      //Simular la creación exitosa del cargo con los datos esperados
      const cargoCreadoEsperado = {
        id: 'generated-uuid-123',
        id_area: payload.id_area,
        nombre: payload.nombre.trim(),
        descripcion: payload.descripcion,
        sueldo_minimo: 1800.0,
        sueldo_maximo: 4000.0,
        activo: true,
        area: { id: areaActiva.id, nombre: areaActiva.nombre }
      };

      mockPrismaService.cargo.create.mockResolvedValue(cargoCreadoEsperado);

      //Act: Ejecutar el caso de uso con el payload de prueba
      const result = await useCase.execute(payload);

      //Assert: Verificar que se llamaron los métodos de Prisma con los parámetros correctos y que el resultado es el esperado
      expect(result).toEqual(cargoCreadoEsperado);
      expect(prisma.cargo.create).toHaveBeenCalledWith({
        data: {
          id: 'generated-uuid-123',
          id_area: payload.id_area,
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion,
          sueldo_minimo: 1800.0,
          sueldo_maximo: 4000.0,
          activo: true
        },
        include: {area: { select: { id: true, nombre: true } } }
      });
    });

    it('Happy Path: Debe aplicar sueldo_minimo por defecto (1130.00) si no se especifica', async () => {
      //Arrange: Simular que el área existe y está activa, y que no existe un cargo con el mismo nombre
      const payloadMinimo: CrearCargoDto = {
        id_area: 'area-uuid-1',
        nombre: 'Practicante Pre Profesional'
      };

      //Simular la creación exitosa del cargo con sueldo_minimo por defecto
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);
      mockPrismaService.cargo.create.mockResolvedValue({
        id: 'generated-uuid-123',
        ...payloadMinimo,
        sueldo_minimo: 1130.0,
        sueldo_maximo: null,
        activo: true
      });

      //Act: Ejecutar el caso de uso con el payload que no especifica sueldo_minimo
      const result = await useCase.execute(payloadMinimo);

      //Assert: Verificar que se aplicó el sueldo_minimo por defecto y que se llamó a la función de creación con los datos correctos
      expect(prisma.cargo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sueldo_minimo: 1130.0,
            sueldo_maximo: null
          })
        })
      );
      expect(result.sueldo_minimo).toBe(1130.0);
    });
  });

  describe('Manejo de Errores Inesperados', () => {
    it('Debe capturar errores del motor de base de datos y lanzar InternalServerErrorException', async () => {
      //Arrange: Simular que el área existe y está activa, pero que la creación del cargo falla debido a un error de base de datos (por ejemplo, deadlock)
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);
      mockPrismaService.cargo.create.mockRejectedValue(new Error('Deadlock en PostgreSQL'));

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance InternalServerErrorException
      await expect(useCase.execute(payload)).rejects.toThrow(InternalServerErrorException);
    });
  });
});