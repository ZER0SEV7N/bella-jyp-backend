//test/modules/RRHH/organizacion/cargo/crearCargo.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { CrearCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/crearCargo.UseCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearCargoDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el caso de uso CrearCargoUseCase.
 * Se cubren los siguientes escenarios:
 * 1. Validación del área asignada: existencia, estado activo y baja lógica.
 * 2. Validación de la jornada laboral sugerida: existencia y estado activo.
 * 3. Validación de nombre duplicado: verificación de existencia de cargo con el mismo nombre en el área.
 * 4. Creación exitosa del cargo: happy path con y sin jornada sugerida.
 */
describe('CrearCargoUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: CrearCargoUseCase;
  let prisma: PrismaService;

  const mockPrismaService = {
    area: { findUnique: jest.fn() },
    jornada: { findUnique: jest.fn() },
    cargo: {findFirst: jest.fn(), create: jest.fn() }
  };

  //Mock de datos para las pruebas unitarias
  const areaActiva = {
    id: 'area-uuid-1',
    nombre: 'Sistemas',
    activo: true,
    deleted_at: null
  };

  const jornadaActiva = {
    id: 'jornada-uuid-1',
    nombre: 'Turno Mañana (Oficina)',
    tipo_jornada: 'FIJA',
    activo: true,
    deleted_at: null
  };

  //Payload de prueba para la creación de un cargo
  const payload: CrearCargoDto = {
    id_area: 'area-uuid-1',
    jornada_sugerida_id: 'jornada-uuid-1',
    nombre: 'Analista de Sistemas Senior',
    descripcion: 'Encargado de soporte y desarrollo'
  };

  //Configuración de pruebas unitarias antes y después de cada test
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

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Validación del Área Asignada', () => {
    it('Debe lanzar NotFoundException si el área especificada no existe', async () => {
      //Arrange: Simulamos que el área no existe en la base de datos
      mockPrismaService.area.findUnique.mockResolvedValue(null);

      //Act & Assert
      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);
      expect(prisma.area.findUnique).toHaveBeenCalledWith({ where: { id: payload.id_area } });
      expect(prisma.cargo.findFirst).not.toHaveBeenCalled();
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el área se encuentra inactiva', async () => {
      //Arrange: Simulamos que el área existe pero está inactiva
      mockPrismaService.area.findUnique.mockResolvedValue({...areaActiva, activo: false});

      //Act & Assert
      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el área posee baja lógica (deleted_at !== null)', async () => {
      //Arrange: Simulamos que el área existe pero tiene baja lógica
      mockPrismaService.area.findUnique.mockResolvedValue({...areaActiva, deleted_at: new Date() });

      //Act & Assert
      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });
  });

  describe('Validación de la Jornada Laboral Sugerida', () => {
    it('Debe lanzar NotFoundException si se proporciona una jornada sugerida que no existe en BD', async () => {
      //Arrange: Simulamos que la jornada sugerida no existe en la base de datos
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.jornada.findUnique.mockResolvedValue(null);

      //Act & Assert
      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);
      expect(prisma.jornada.findUnique).toHaveBeenCalledWith({where: { id: payload.jornada_sugerida_id }});
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si la jornada sugerida está inactiva o deshabilitada', async () => {
      //Arrange: Simulamos que la jornada sugerida existe pero está inactiva
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.jornada.findUnique.mockResolvedValue({...jornadaActiva, activo: false});

      //Act & Assert
      await expect(useCase.execute(payload)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Validación de Nombre Duplicado y Creación Exitosa', () => {
    it('Debe lanzar BadRequestException si ya existe un cargo con el mismo nombre en el área', async () => {
      //Arrange: Simulamos que ya existe un cargo con el mismo nombre en el área
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.jornada.findUnique.mockResolvedValue(jornadaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue({
        id: 'cargo-existente-id',
        nombre: 'Analista de Sistemas Senior',
        id_area: payload.id_area,
      });

      //Act & Assert
      await expect(useCase.execute(payload)).rejects.toThrow(BadRequestException);
      expect(prisma.cargo.findFirst).toHaveBeenCalledWith({
        where: {nombre: payload.nombre.trim(), id_area: payload.id_area,}
      });
      expect(prisma.cargo.create).not.toHaveBeenCalled();
    });

    it('Happy Path: Debe crear el cargo vinculando área y jornada sugerida con éxito', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.jornada.findUnique.mockResolvedValue(jornadaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);

      const cargoCreadoEsperado = {
        id: 'generated-uuid-123',
        id_area: payload.id_area,
        jornada_sugerida_id: payload.jornada_sugerida_id,
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        activo: true,
        area: { id: areaActiva.id, nombre: areaActiva.nombre },
        jornada_sugerida: jornadaActiva,
      };

      mockPrismaService.cargo.create.mockResolvedValue(cargoCreadoEsperado);

      const result = await useCase.execute(payload);

      expect(result).toEqual(cargoCreadoEsperado);
      expect(prisma.cargo.create).toHaveBeenCalledWith({
        data: {
          id: 'generated-uuid-123',
          id_area: payload.id_area,
          jornada_sugerida_id: payload.jornada_sugerida_id,
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion,
          activo: true,
        },
        include: {
          area: { select: { id: true, nombre: true } },
          jornada_sugerida: {
            select: {
              id: true,
              nombre: true,
              tipo_jornada: true,
              hora_entrada: true,
              hora_salida: true,
            },
          },
        },
      });
    });

    it('Happy Path (Opcional): Debe crear el cargo sin jornada sugerida si no se envía el campo', async () => {
      const payloadSinJornada: CrearCargoDto = {
        id_area: 'area-uuid-1',
        nombre: 'Practicante Pre Profesional',
      };

      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);
      mockPrismaService.cargo.create.mockResolvedValue({
        id: 'generated-uuid-123',
        ...payloadSinJornada,
        jornada_sugerida_id: null,
        jornada_sugerida: null,
      });

      const result = await useCase.execute(payloadSinJornada);

      expect(prisma.jornada.findUnique).not.toHaveBeenCalled();
      expect(result.jornada_sugerida).toBeNull();
    });
  });

  describe('Manejo de Errores Inesperados', () => {
    it('Debe capturar errores del motor de base de datos y lanzar InternalServerErrorException', async () => {
      mockPrismaService.area.findUnique.mockResolvedValue(areaActiva);
      mockPrismaService.jornada.findUnique.mockResolvedValue(jornadaActiva);
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);
      mockPrismaService.cargo.create.mockRejectedValue(new Error('Deadlock en PostgreSQL'));

      await expect(useCase.execute(payload)).rejects.toThrow(InternalServerErrorException);
    });
  });
});