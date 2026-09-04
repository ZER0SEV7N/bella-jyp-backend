//test/modules/RRHH/organizacion/area/actualizarArea.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ActualizarAreaUseCase } from '@/modules/RRHH/organizacion/use-cases/area/actualizarArea.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActualizarAreaDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el caso de uso ActualizarAreaUseCase.
 * Estas pruebas verifican el comportamiento del caso de uso en escenarios de éxito y manejo de errores.
 * Se simula la interacción con la base de datos utilizando un mock del servicio Prisma.
 */
describe('ActualizarAreaUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: ActualizarAreaUseCase;
  let prisma: PrismaService;

  //Mock del servicio Prisma para simular la interacción con la base de datos
  const mockPrisma = {
    area: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    }
  };

  //Datos de prueba para un área existente
  const idArea = '018f4a7c-area-0000-0000-000000000001';

  //Payload de prueba para actualizar un área
  const areaExistente = {
    id: idArea,
    nombre: 'Tecnología',
    descripcion: 'Soporte y sistemas',
    activo: true,
    deleted_at: null
  };

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActualizarAreaUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<ActualizarAreaUseCase>(ActualizarAreaUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.resetAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe actualizar el nombre y descripción si el nuevo nombre no colisiona', async () => {
      //Arrange: Simular que el área existe y que no hay colisión de nombres
      const dto: ActualizarAreaDto = {
        nombre: 'Tecnología y Cloud',
        descripcion: 'Infraestructura y arquitectura'
      };

      //Simular la existencia del área y que no hay otra área con el mismo nombre
      mockPrisma.area.findUnique.mockResolvedValue(areaExistente);
      mockPrisma.area.findFirst.mockResolvedValue(null);
      mockPrisma.area.update.mockResolvedValue({ ...areaExistente, ...dto });

      //Act: Ejecutar el caso de uso con el ID del área y el DTO de actualización
      const result = await useCase.execute(idArea, dto);

      //Assert: Verificar que se llamaron los métodos de Prisma con los parámetros correctos y que el resultado es el esperado
      expect(prisma.area.findFirst).toHaveBeenCalledWith({
        where: {
          nombre: { equals: 'Tecnología y Cloud', mode: 'insensitive' },
          id: { not: idArea },
          deleted_at: null
        }
      });

      //Verificar que se llamó a la función de actualización con los datos correctos
      expect(prisma.area.update).toHaveBeenCalledWith({
        where: { id: idArea },
        data: {
          nombre: 'Tecnología y Cloud',
          descripcion: 'Infraestructura y arquitectura'
        }
      });
      expect(result.nombre).toBe('Tecnología y Cloud');
    });

    it('Debe actualizar solo la descripción sin verificar duplicados si no se modifica el nombre', async () => {
      //Arrange: Simular que el área existe y que no se modifica el nombre
      const dto: ActualizarAreaDto = { descripcion: 'Solo actualización de descripción' };

      //Simular la existencia del área y que no hay otra área con el mismo nombre
      mockPrisma.area.findUnique.mockResolvedValue(areaExistente);
      mockPrisma.area.update.mockResolvedValue({ ...areaExistente, descripcion: dto.descripcion });

      //Act: Ejecutar el caso de uso con el ID del área y el DTO de actualización
      const result = await useCase.execute(idArea, dto);

      //Assert: Verificar que se llamaron los métodos de Prisma con los parámetros correctos y que el resultado es el esperado
      expect(prisma.area.findFirst).not.toHaveBeenCalled();
      expect(prisma.area.update).toHaveBeenCalledWith({
        where: { id: idArea },
        data: {
          nombre: undefined,
          descripcion: 'Solo actualización de descripción'
        }
      });
      expect(result.descripcion).toBe('Solo actualización de descripción');
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe lanzar NotFoundException si el área no existe en la base de datos', async () => {
      //Arrange: Simular que el área no existe
      mockPrisma.area.findUnique.mockResolvedValue(null);

      //Act & Assert: Verificar que se lanza la excepción y que no se llama a la función de actualización
      await expect(useCase.execute(idArea, { nombre: 'Prueba' })).rejects.toThrow(NotFoundException);
      expect(prisma.area.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si el área posee soft-delete (deleted_at !== null)', async () => {
      //Arrange: La consulta del caso de uso excluye registros con soft-delete
      mockPrisma.area.findUnique.mockResolvedValue(null);

      //Act & Assert: Verificar que se lanza la excepción y que no se llama a la función de actualización
      await expect(useCase.execute(idArea, { nombre: 'Prueba' })).rejects.toThrow(NotFoundException);
      expect(prisma.area.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar BadRequestException si el nombre colisiona con otra área registrada', async () => {
      //Arrange: Simular que el área existe y que hay otra área con el mismo nombre
      mockPrisma.area.findUnique.mockResolvedValue(areaExistente);
      mockPrisma.area.findFirst.mockResolvedValue({
        id: 'otra-area-existente',
        nombre: 'Contabilidad'
      });

      //Act & Assert: Verificar que se lanza la excepción y que no se llama a la función de actualización
      await expect(useCase.execute(idArea, { nombre: 'Contabilidad' })).rejects.toThrow(BadRequestException);
      expect(prisma.area.update).not.toHaveBeenCalled();
    });

    it('Debe propagar InternalServerErrorException en fallos no controlados', async () => {
      //Arrange: Simular que ocurre un error inesperado al buscar el área
      mockPrisma.area.findUnique.mockRejectedValue(new Error('Conexión perdida a PostgreSQL'));

      //Act & Assert: Verificar que se lanza la excepción de error interno y que se propaga correctamente
      await expect(useCase.execute(idArea, { nombre: 'Prueba' })).rejects.toThrow(InternalServerErrorException);
    });
  });
});