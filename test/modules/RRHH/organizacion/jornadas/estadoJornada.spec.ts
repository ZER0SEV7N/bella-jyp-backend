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
    jornada: { findUnique: jest.fn(), update: jest.fn() },
    empleados: {count: jest.fn() }
  };

  //Datos simulados para las pruebas
  const idJornada = 'jornada-uuid-777';

  //Configuración del módulo de pruebas antes de cada test
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

  describe('desactivar() - Soft Delete y Bloqueo por Empleados Asignados', () => {
    it('Happy Path: Debe desactivar la jornada aplicando Soft Delete si ningún colaborador activo la ocupa', async () => {
      //Arrange: Se simula que PrismaService encuentra la jornada y que no hay empleados activos asignados a ella
      mockPrisma.jornada.findUnique.mockResolvedValue({
        id: idJornada,
        nombre: 'Turno Madrugada',
        activo: true,
        deleted_at: null
      });

      mockPrisma.empleados.count.mockResolvedValue(0);

      mockPrisma.jornada.update.mockResolvedValue({
        id: idJornada,
        activo: false,
        deleted_at: new Date()
      });

      //Act: Se ejecuta el caso de uso para desactivar la jornada
      const resultado = await useCase.desactivar(idJornada);

      //Assert: Se verifica que la jornada haya sido desactivada correctamente 
      //y que PrismaService haya sido llamado con los parámetros esperados
      expect(resultado.activo).toBe(false);
      expect(mockPrisma.empleados.count).toHaveBeenCalledWith({where: {
        jornada_id: idJornada,
        activo: true,
        deleted_at: null
      }});
      expect(mockPrisma.jornada.update).toHaveBeenCalledWith({where: { id: idJornada }, data: expect.objectContaining({ activo: false })});
    });

    it('Regla de Negocio: Debe bloquear la desactivación con BadRequestException si hay colaboradores activos usándola', async () => {
      //Arrange: Se simula que PrismaService encuentra la jornada y que hay 5 empleados activos asignados a ella
      mockPrisma.jornada.findUnique.mockResolvedValue({
        id: idJornada,
        activo: true,
        deleted_at: null
      });

      //Se simula que hay 5 colaboradores activos asignados a la jornada
      mockPrisma.empleados.count.mockResolvedValue(5); //5 colaboradores asignados

      //Act & Assert: Se espera que el caso de uso lance BadRequestException al intentar desactivar la jornada
      await expect(useCase.desactivar(idJornada)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si la jornada a desactivar no existe o ya fue eliminada', async () => {
      //Arrange: Se simula que PrismaService no encuentra la jornada en la base de datos
      mockPrisma.jornada.findUnique.mockResolvedValue(null);

      //Act & Assert: Se espera que el caso de uso lance NotFoundException al intentar desactivar una jornada inexistente
      await expect(useCase.desactivar(idJornada)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.empleados.count).not.toHaveBeenCalled();
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar InternalServerErrorException en caso de fallo crítico en base de datos', async () => {
      //Arrange: Se simula que PrismaService encuentra la jornada y que no hay empleados activos asignados a ella, pero la actualización falla
      mockPrisma.jornada.findUnique.mockResolvedValue({id: idJornada, deleted_at: null});
      mockPrisma.empleados.count.mockResolvedValue(0);
      mockPrisma.jornada.update.mockRejectedValue(new InternalServerErrorException('Fallo crítico en PostgreSQL'));

      //Act & Assert: Se espera que el caso de uso lance InternalServerErrorException al intentar desactivar la jornada
      await expect(useCase.desactivar(idJornada)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('reactivar() - Restauración de Jornada Desactivada', () => {
    it('Happy Path: Debe reactivar la jornada restableciendo activo=true y deleted_at=null', async () => {
      //Arrange: Se simula que PrismaService encuentra la jornada desactivada y que la actualización se realiza correctamente
      mockPrisma.jornada.findUnique.mockResolvedValue({
        id: idJornada,
        activo: false,
        deleted_at: new Date('2026-01-01')
      });

      //Se simula que la jornada es restaurada correctamente
      const jornadaRestaurada = {
        id: idJornada,
        activo: true,
        deleted_at: null
      };

      //Se simula que la actualización en PrismaService devuelve la jornada restaurada
      mockPrisma.jornada.update.mockResolvedValue(jornadaRestaurada);

      //Act: Se ejecuta el caso de uso para reactivar la jornada
      const resultado = await useCase.reactivar(idJornada);

      //Assert: Se verifica que la jornada haya sido reactivada correctamente y que PrismaService haya sido llamado con los parámetros esperados
      expect(resultado.activo).toBe(true);
      expect(resultado.deleted_at).toBeNull();
      expect(mockPrisma.jornada.update).toHaveBeenCalledWith({
        where: { id: idJornada },
        data: { activo: true, deleted_at: null }
      });
    });

    it('Debe lanzar NotFoundException si la jornada a reactivar no existe en BD', async () => {
      //Arrange: Se simula que PrismaService no encuentra la jornada en la base de datos
      mockPrisma.jornada.findUnique.mockResolvedValue(null);

      //Act & Assert: Se espera que el caso de uso lance NotFoundException al intentar reactivar una jornada inexistente
      await expect(useCase.reactivar(idJornada)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar InternalServerErrorException si la restauración falla en BD', async () => {
      //Arrange: Se simula que PrismaService encuentra la jornada desactivada pero la actualización falla
      mockPrisma.jornada.findUnique.mockResolvedValue({ id: idJornada });
      mockPrisma.jornada.update.mockRejectedValue(new Error('Conexión perdida'));

      //Act & Assert: Se espera que el caso de uso lance InternalServerErrorException al intentar reactivar la jornada
      await expect(useCase.reactivar(idJornada)).rejects.toThrow(InternalServerErrorException);
    });
  });
});