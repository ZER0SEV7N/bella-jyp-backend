//test/modules/RRHH/organizacion/cargo/listarCargo.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ListarCargosUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/listarCargos.useCase';
import type { ListarCargosQueryDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias para el caso de uso ListarCargosUseCase, que maneja la paginación y filtrado de cargos en el módulo de RRHH.
 * Se simula el comportamiento del servicio Prisma para verificar la lógica de negocio y las excepciones lanzadas en diferentes escenarios.
 * Se incluyen pruebas para paginación por defecto, cálculo de skip, filtros por área, jornada sugerida y estado activo, así como manejo de errores inesperados.
 */
describe('ListarCargosUseCase - Pruebas Unitarias de Paginación y Filtros Avanzados', () => {
  let useCase: ListarCargosUseCase;

  //Mocks de Prisma para simular la interacción con la base de datos
  const mockPrisma = {
    cargo: {count: jest.fn(), findMany: jest.fn()},
    $transaction: jest.fn((queries: Promise<any>[]) => Promise.all(queries)),
  };

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarCargosUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<ListarCargosUseCase>(ListarCargosUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  //Pruebas para la paginación por defecto y cálculo de skip
  describe('Paginación por Defecto y Cálculo de Skip', () => {
    it('Debe listar cargos con paginación por defecto (page: 1, limit: 50) incluyendo área y jornada sugerida', async () => {
      //Arrange: Simular la respuesta de Prisma para contar y listar cargos
      const query = {} as ListarCargosQueryDto;
      const cargosSimulados = [{
        id: 'cargo-1',
        nombre: 'Analista de Nóminas',
        area: { id: 'area-1', nombre: 'Recursos Humanos' },
        jornada_sugerida: {
          id: 'jornada-1',
          nombre: 'Turno Mañana',
          tipo_jornada: 'FIJA',
          hora_entrada: new Date(),
          hora_salida: new Date()
        },
        _count: { empleados: 2 }
      }];

      //Simular la respuesta de Prisma al contar y listar cargos
      mockPrisma.cargo.count.mockResolvedValueOnce(1);
      mockPrisma.cargo.findMany.mockResolvedValueOnce(cargosSimulados);

      //Act: Ejecutar la use case para listar cargos con paginación por defecto
      const resultado = await useCase.listar(query);

      //Assert: Verificar que la respuesta contenga los datos esperados y que se realizaron las llamadas esperadas a Prisma
      expect(resultado).toEqual({
        data: cargosSimulados,
        meta: {total: 1, page: 1, limit: 50, totalPages: 1 }
      });

      expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        skip: 0,
        take: 50,
        orderBy: { nombre: 'asc' },
        include: {
          area: { select: { id: true, nombre: true } },
          jornada_sugerida: {
            select: {
              id: true,
              nombre: true,
              tipo_jornada: true,
              hora_entrada: true,
              hora_salida: true
            }
          },
          _count: {select: {empleados: { where: { activo: true, deleted_at: null } } } }
        }
      });
    });

    it('Debe calcular correctamente el skip y totalPages (page: 3, limit: 10)', async () => {
      //Arrange: Simular la respuesta de Prisma para contar y listar cargos con paginación específica
      const query = { page: 3, limit: 10 } as ListarCargosQueryDto;

      //Simular la respuesta de Prisma al contar y listar cargos
      mockPrisma.cargo.count.mockResolvedValueOnce(25);
      mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar la use case para listar cargos con paginación específica
      const resultado = await useCase.listar(query);

      //Assert: Verificar que la respuesta contenga los datos esperados y que se realizaron las llamadas esperadas a Prisma
      expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
      expect(resultado.meta).toEqual({ total: 25, page: 3, limit: 10, totalPages: 3 });
    });
  });

  describe('Filtros por Área, Jornada Sugerida y Estado Activo', () => {
    it('Debe filtrar por jornada_sugerida_id cuando se envía en la consulta', async () => {
      //Arrange: Simular la respuesta de Prisma para contar y listar cargos con filtro por jornada sugerida
      const query: ListarCargosQueryDto = {
        page: 1,
        limit: 50,
        jornada_sugerida_id: 'jornada-uuid-999',
      };

      //Simular la respuesta de Prisma al contar y listar cargos
      mockPrisma.cargo.count.mockResolvedValueOnce(0);
      mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar la use case para listar cargos con filtro por jornada sugerida
      await useCase.listar(query);

      //Assert: Verificar que se realizaron las llamadas esperadas a Prisma con el filtro correcto
      expect(mockPrisma.cargo.count).toHaveBeenCalledWith({where: { deleted_at: null, jornada_sugerida_id: 'jornada-uuid-999' }});
      expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith(expect.objectContaining({where: { deleted_at: null, jornada_sugerida_id: 'jornada-uuid-999' }}));
    });

    it('Debe combinar múltiples filtros (id_area, jornada_sugerida_id y activo=false)', async () => {
      //Arrange: Simular la respuesta de Prisma para contar y listar cargos con múltiples filtros
      const query: ListarCargosQueryDto = {
        page: 1,
        limit: 50,
        id_area: 'area-uuid-1',
        jornada_sugerida_id: 'jornada-uuid-2',
        activo: false
      };

      //Simular la respuesta de Prisma al contar y listar cargos
      mockPrisma.cargo.count.mockResolvedValueOnce(0);
      mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar la use case para listar cargos con múltiples filtros
      await useCase.listar(query);

      //Assert: Verificar que se realizaron las llamadas esperadas a Prisma con los filtros correctos
      expect(mockPrisma.cargo.count).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          id_area: 'area-uuid-1',
          jornada_sugerida_id: 'jornada-uuid-2',
          activo: false
        }
      });
    });
  });

  describe('Manejo de Excepciones', () => {
    it('Debe transformar fallos inesperados de consulta a InternalServerErrorException', async () => {
      //Arrange: Simular que Prisma lanza un error inesperado al contar cargos
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('PostgreSQL Connection Failure'));

      await expect(useCase.listar({ page: 1, limit: 50 })).rejects.toThrow(InternalServerErrorException);
    });
  });
});