//test/modules/RRHH/organizacion/area/estadoArea.UseCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { EstadoAreaUseCase } from '@/modules/RRHH/organizacion/use-cases/area/estadoArea.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias exhaustivas para el caso de uso EstadoAreaUseCase.
 * Estas pruebas verifican el comportamiento del caso de uso en escenarios de éxito y manejo de errores.
 * Se simula la interacción con la base de datos utilizando un mock del servicio Prisma.
 */
describe('EstadoAreaUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: EstadoAreaUseCase;
  let prisma: PrismaService;

  //Mock del servicio Prisma para simular la interacción con la base de datos
  const mockPrisma = {
    area: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  };

  //Datos de prueba para un área existente
  const idArea = '018f4a7c-area-0000-0000-000000000001';

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadoAreaUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<EstadoAreaUseCase>(EstadoAreaUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('desactivar() - Soft Delete y Bloqueos de Integridad', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe aplicar soft delete (activo=false, deleted_at=fecha) si no tiene empleados ni cargos activos', async () => {
        //Arrange: Simular que el área existe y no tiene empleados ni cargos activos
        mockPrisma.area.findUnique.mockResolvedValue({
          id: idArea,
          nombre: 'Auditoría Interna',
          activo: true,
          deleted_at: null,
          _count: { cargo: 0, empleados: 0 }
        });

        //Simular que la actualización es exitosa
        mockPrisma.area.update.mockResolvedValue({
          id: idArea,
          activo: false,
          deleted_at: new Date(),
        });

        //Act: Ejecutar el caso de uso para desactivar el área
        const result = await useCase.desactivar(idArea);

        //Assert: Verificar que se llamaron los métodos de Prisma con los parámetros correctos y que el resultado es el esperado
        expect(prisma.area.findUnique).toHaveBeenCalledWith({
          where: { id: idArea, deleted_at: null },
          include: {
            _count: {
              select: {
                cargo: { where: { activo: true, deleted_at: null } },
                empleados: { where: { activo: true, deleted_at: null } }
              }
            }
          }
        });
        expect(prisma.area.update).toHaveBeenCalledWith({
          where: { id: idArea },
          data: { activo: false, deleted_at: expect.any(Date) }
        });
        expect(result.activo).toBe(false);
      });
    });

    describe('Reglas de Negocio y Excepciones', () => {
      it('Debe bloquear con BadRequestException si el área contiene empleados activos asignados', async () => {
        //Arrange: Simular que el área existe y tiene empleados activos asociados
        mockPrisma.area.findUnique.mockResolvedValue({
          id: idArea,
          nombre: 'Operaciones',
          activo: true,
          deleted_at: null,
          _count: { cargo: 0, empleados: 5 }
        });

        //Act & Assert: Verificar que se lanza la excepción y que no se llama a la función de actualización
        await expect(useCase.desactivar(idArea)).rejects.toThrow(BadRequestException);
        expect(prisma.area.update).not.toHaveBeenCalled();
      });

      it('Debe bloquear con BadRequestException si el área contiene cargos activos asociados', async () => {
        //Arrange: Simular que el área existe y tiene cargos activos asociados
        mockPrisma.area.findUnique.mockResolvedValue({
          id: idArea,
          nombre: 'Administración',
          activo: true,
          deleted_at: null,
          _count: { cargo: 3, empleados: 0 }
        });

        //Act & Assert: Verificar que se lanza la excepción y que no se llama a la función de actualización
        await expect(useCase.desactivar(idArea)).rejects.toThrow(BadRequestException);
        expect(prisma.area.update).not.toHaveBeenCalled();
      });

      it('Debe lanzar NotFoundException si el área no existe o ya está dada de baja', async () => {
        //Arrange: Simular que el área no existe o ya fue desactivada
        mockPrisma.area.findUnique.mockResolvedValue(null);

        //Act & Assert: Verificar que se lanza la excepción y que no se llama a la función de actualización
        await expect(useCase.desactivar(idArea)).rejects.toThrow(NotFoundException);
        expect(prisma.area.update).not.toHaveBeenCalled();
      });

      it('Debe propagar InternalServerErrorException en caso de fallo crítico en base de datos', async () => {
        //Arrange: Simular que ocurre un error inesperado al buscar el área
        mockPrisma.area.findUnique.mockRejectedValue(new Error('Fallo de conexión'));

        //Act & Assert: Verificar que se lanza la excepción de error interno y que se propaga correctamente
        await expect(useCase.desactivar(idArea)).rejects.toThrow(InternalServerErrorException);
      });
    });
  });

  describe('reactivar() - Restauración de Áreas', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe reactivar el área estableciendo activo=true y deleted_at=null', async () => {
        //Arrange: Simular que el área existe y está desactivada
        mockPrisma.area.findUnique.mockResolvedValue({
          id: idArea,
          nombre: 'Área Inactiva',
          activo: false,
          deleted_at: new Date('2026-01-01')
        });

        //Simular que la reactivación es exitosa
        mockPrisma.area.update.mockResolvedValue({
          id: idArea,
          nombre: 'Área Inactiva',
          activo: true,
          deleted_at: null
        });

        //Act: Ejecutar el caso de uso para reactivar el área
        const result = await useCase.reactivar(idArea);

        //Assert: Verificar que se llamaron los métodos de Prisma con los parámetros correctos y que el resultado es el esperado
        expect(prisma.area.update).toHaveBeenCalledWith({
          where: { id: idArea },
          data: { activo: true, deleted_at: null }
        });
        expect(result.activo).toBe(true);
        expect(result.deleted_at).toBeNull();
      });
    });

    describe('Reglas de Negocio y Excepciones', () => {
      it('Debe lanzar BadRequestException si el área ya se encuentra activa', async () => {
        //Arrange: Simular que el área ya está activa
        mockPrisma.area.findUnique.mockResolvedValue({
          id: idArea,
          nombre: 'Área Operativa',
          activo: true,
          deleted_at: null
        });

        //Act & Assert: Verificar que se lanza la excepción y que no se llama a la función de actualización
        await expect(useCase.reactivar(idArea)).rejects.toThrow(BadRequestException);
        expect(prisma.area.update).not.toHaveBeenCalled();
      });

      it('Debe lanzar NotFoundException si el área a reactivar no existe', async () => {
        //Arrange: Simular que el área no existe
        mockPrisma.area.findUnique.mockResolvedValue(null);

        //Act & Assert: Verificar que se lanza la excepción y que no se llama a la función de actualización
        await expect(useCase.reactivar(idArea)).rejects.toThrow(NotFoundException);
        expect(prisma.area.update).not.toHaveBeenCalled();
      });
    });
  });
});