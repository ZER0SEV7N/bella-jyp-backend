//test/modules/RRHH/organizacion/jornadas/estadoJornada.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { EstadoJornadaUseCase } from '@/modules/RRHH/organizacion/use-cases/jornadas/estadoJornada.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso EstadoJornadaUseCase, enfocadas en la desactivación y reactivación de jornadas.
 * Se simula el comportamiento del servicio PrismaService para verificar que el caso de uso maneje correctamente
 * la lógica de soft delete, bloqueo por empleados asignados y restauración de jornadas.
 * Además, se valida que las excepciones sean propagadas adecuadamente en caso de errores o violaciones de reglas de negocio.
 */
describe('EstadoJornadaUseCase - Pruebas Unitarias de Desactivación y Reactivación', () => {
  let useCase: EstadoJornadaUseCase;
  let prisma: PrismaService;

  //Mock del servicio PrismaService para simular la interacción con la base de datos
  const mockPrisma = {
    jornada: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  };

  //Datos de prueba para una jornada existente
  const idJornada = 'jornada-uuid-777';

  //Configuración de pruebas antes de cada caso
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadoJornadaUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<EstadoJornadaUseCase>(EstadoJornadaUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('desactivar() - Soft Delete y Regla de Empleados', () => {
    it('Happy Path: Debe desactivar la jornada si ningún empleado activo la utiliza', async () => {
      //Arrange: Simular que la jornada existe y no tiene empleados activos asignados
      mockPrisma.jornada.findUnique.mockResolvedValue({
        id: idJornada,
        nombre: 'Turno Madrugada',
        activo: true,
        deleted_at: null,
        _count: { empleados: 0 }
      });

      //Simular la actualización exitosa de la jornada
      mockPrisma.jornada.update.mockResolvedValue({
        id: idJornada,
        activo: false,
        deleted_at: new Date()
      });

      //Act: Ejecutar el caso de uso para desactivar la jornada
      const resultado = await useCase.desactivar(idJornada);

      //Assert: Verificar que la jornada fue desactivada correctamente
      expect(resultado.activo).toBe(false);
      expect(mockPrisma.jornada.findUnique).toHaveBeenCalledWith({
        where: { id: idJornada, deleted_at: null },
        include: {
          _count: {
            select: { empleados: { where: { activo: true, deleted_at: null } } }
          }
        }
      });
      
      //Verificar que la actualización se realizó con los datos correctos
      expect(mockPrisma.jornada.update).toHaveBeenCalledWith({
        where: { id: idJornada },
        data: { activo: false, deleted_at: expect.any(Date) }
      });
    });

    it('Regla de Negocio: Debe bloquear la desactivación con BadRequestException si hay colaboradores asignados', async () => {
      //Arrange: Simular que la jornada existe y tiene empleados activos asignados
      mockPrisma.jornada.findUnique.mockResolvedValue({
        id: idJornada,
        nombre: 'Turno Mañana',
        activo: true,
        deleted_at: null,
        _count: { empleados: 3 }, //3 empleados activos
      });

      //Act & Assert: Ejecutar el caso de uso y esperar que lance BadRequestException
      await expect(useCase.desactivar(idJornada)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si la jornada a desactivar no existe o ya fue eliminada', async () => {
      //Arrange: Simular que la jornada no existe en la base de datos
      mockPrisma.jornada.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutar el caso de uso y esperar que lance NotFoundException
      await expect(useCase.desactivar(idJornada)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar InternalServerErrorException en caso de error en base de datos', async () => {
      //Arrange: Simular un fallo inesperado en la base de datos al intentar buscar la jornada
      mockPrisma.jornada.findUnique.mockRejectedValue(new Error('Fallo crítico'));

      //Act & Assert: Ejecutar el caso de uso y esperar que lance InternalServerErrorException
      await expect(useCase.desactivar(idJornada)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('reactivar() - Restauración de Jornada', () => {
    it('Happy Path: Debe reactivar la jornada restableciendo activo=true y deleted_at=null', async () => {
      //Arrange: Simular que la jornada existe y está desactivada
      mockPrisma.jornada.findUnique.mockResolvedValue({
        id: idJornada,
        nombre: 'Turno Desactivado',
        activo: false,
        deleted_at: new Date('2026-01-01')
      });

      //Simular la actualización exitosa de la jornada
      mockPrisma.jornada.update.mockResolvedValue({
        id: idJornada,
        activo: true,
        deleted_at: null
      });

      //Act: Ejecutar el caso de uso para reactivar la jornada
      const resultado = await useCase.reactivar(idJornada);

      //Assert: Verificar que la jornada fue reactivada correctamente
      expect(resultado.activo).toBe(true);
      expect(resultado.deleted_at).toBeNull();
      expect(mockPrisma.jornada.update).toHaveBeenCalledWith({
        where: { id: idJornada },
        data: { activo: true, deleted_at: null }
      });
    });

    it('Debe lanzar BadRequestException si la jornada ya se encuentra activa', async () => {
      //Arrange: Simular que la jornada existe y ya está activa
      mockPrisma.jornada.findUnique.mockResolvedValue({
        id: idJornada,
        nombre: 'Turno Activo',
        activo: true,
        deleted_at: null
      });

      //Act & Assert: Ejecutar el caso de uso y esperar que lance BadRequestException
      await expect(useCase.reactivar(idJornada)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si la jornada a reactivar no existe', async () => {
      //Arrange: Simular que la jornada no existe en la base de datos
      mockPrisma.jornada.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutar el caso de uso y esperar que lance NotFoundException
      await expect(useCase.reactivar(idJornada)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });
  });
});