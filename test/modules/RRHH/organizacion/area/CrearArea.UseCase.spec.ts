//test/modules/RRHH/organizacion/area/CrearArea.UseCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CrearAreaUseCase } from '@/modules/RRHH/organizacion/use-cases/area/crearArea.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearAreaDto } from '@jyp/shared-contracts';

describe('CrearAreaUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: CrearAreaUseCase;
  let prisma: PrismaService;

  //Mock del servicio Prisma para simular la interacción con la base de datos
  const mockPrisma = {
    area: {
      findFirst: jest.fn(),
      create: jest.fn()
    }
  };

  //Payload de prueba para crear un área
  const payload: CrearAreaDto = {
    nombre: '  Recursos Humanos  ',
    descripcion: 'Gestión y cultura de talento'
  };

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrearAreaUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<CrearAreaUseCase>(CrearAreaUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    jest.spyOn(IdentityGenerator, 'generateId').mockReturnValue('018f4a7c-area-0000-0000-000000000001');
  });

  afterEach(() => jest.clearAllMocks());

  //Pruebas unitarias para el caso de uso CrearAreaUseCase
  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe registrar una nueva área limpiando espacios (trim) y asignando activo=true', async () => {
      //Arrange: Simular que no existe un área con el mismo nombre y que la creación es exitosa
      mockPrisma.area.findFirst.mockResolvedValue(null);
      mockPrisma.area.create.mockResolvedValue({
        id: '018f4a7c-area-0000-0000-000000000001',
        nombre: 'Recursos Humanos',
        descripcion: 'Gestión y cultura de talento',
        activo: true,
        deleted_at: null
      });

      //Act: Ejecutar el caso de uso con el payload de prueba
      const result = await useCase.execute(payload);

      //Assert: Verificar que se llamaron los métodos de Prisma con los parámetros correctos y que el resultado es el esperado
      expect(prisma.area.findFirst).toHaveBeenCalledWith({
        where: {
          nombre: { equals: 'Recursos Humanos', mode: 'insensitive' },
          deleted_at: null
        }
      });

      //Verificar que se llamó a la función de creación con los datos correctos
      expect(prisma.area.create).toHaveBeenCalledWith({
        data: {
          id: '018f4a7c-area-0000-0000-000000000001',
          nombre: 'Recursos Humanos',
          descripcion: 'Gestión y cultura de talento',
          activo: true
        }
      });
      expect(result.id).toBe('018f4a7c-area-0000-0000-000000000001');
      expect(result.nombre).toBe('Recursos Humanos');
    });

    it('Debe registrar un área con descripción nula si no se proporciona', async () => {
      //Arrange: Simular que no existe un área con el mismo nombre y que la creación es exitosa
      const payloadSinDescripcion: CrearAreaDto = { nombre: 'Logística' };
      mockPrisma.area.findFirst.mockResolvedValue(null);
      mockPrisma.area.create.mockResolvedValue({
        id: '018f4a7c-area-0000-0000-000000000001',
        nombre: 'Logística',
        descripcion: null,
        activo: true
      });

      //Act: Ejecutar el caso de uso con el payload sin descripción
      const result = await useCase.execute(payloadSinDescripcion);

      //Assert: Verificar que se llamaron los métodos de Prisma con los parámetros correctos y que el resultado es el esperado
      expect(prisma.area.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nombre: 'Logística',
          descripcion: null
        })
      });
      expect(result.descripcion).toBeNull();
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe lanzar BadRequestException si ya existe un área con el mismo nombre (case-insensitive)', async () => {
      //Arrange: Simular que ya existe un área con el mismo nombre (insensible a mayúsculas/minúsculas)
      mockPrisma.area.findFirst.mockResolvedValue({
        id: 'otra-area',
        nombre: 'RECURSOS HUMANOS'
      });

      //Act & Assert: Verificar que se lanza la excepción y que no se llama a la función de creación
      await expect(useCase.execute(payload)).rejects.toThrow(BadRequestException);
      expect(prisma.area.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar InternalServerErrorException ante errores inesperados del motor de base de datos', async () => {
      //Arrange: Simular que no existe un área con el mismo nombre y que ocurre un error inesperado al crear el área
      mockPrisma.area.findFirst.mockResolvedValue(null);
      mockPrisma.area.create.mockRejectedValue(new Error('PostgreSQL deadlock error'));

      //Act & Assert: Verificar que se lanza la excepción de error interno y que se propaga correctamente
      await expect(useCase.execute(payload)).rejects.toThrow(InternalServerErrorException);
    });
  });
});