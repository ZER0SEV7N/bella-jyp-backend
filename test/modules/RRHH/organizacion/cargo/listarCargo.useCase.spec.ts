//test/modules/RRHH/organizacion/cargo/listarCargo.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ListarCargosUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/listarCargos.useCase';
import type { ListarCargosQueryDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias para el caso de uso ListarCargosUseCase, que maneja la paginación y filtrado de cargos en el módulo de RRHH.
 * Se simula el comportamiento del servicio Prisma para verificar la lógica de negocio y las excepciones lanzadas en diferentes escenarios.
 * Se incluyen pruebas para paginación por defecto, cálculo de skip, filtros por search, área y estado activo.
 */
describe('ListarCargosUseCase - Pruebas Unitarias de Paginación y Filtros Avanzados', () => {
  let useCase: ListarCargosUseCase;

  //Mock del servicio Prisma para simular la interacción con la base de datos
  const mockPrisma = {
    cargo: { count: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((queries: Promise<any>[]) => Promise.all(queries))
  };

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarCargosUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<ListarCargosUseCase>(ListarCargosUseCase);
  });

  //Limpiar los mocks después de cada test para evitar interferencias entre pruebas
  afterEach(() => jest.clearAllMocks());

  
  describe('Paginación por Defecto y Mapeo de Atributos', () => {
    it('Debe listar cargos con paginación por defecto e incluir área, bandas salariales y conteo de empleados', async () => {
      //Arrange: Simular que hay un cargo existente y que la consulta devuelve un total de 1
      const query = {} as ListarCargosQueryDto;
      const cargosSimulados = [{
        id: 'cargo-1',
        id_area: 'area-1',
        nombre: 'Analista de Nóminas',
        descripcion: 'Cálculo de planillas',
        sueldo_minimo: 2000.0,
        sueldo_maximo: 4000.0,
        activo: true,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01'),
        area: { id: 'area-1', nombre: 'Recursos Humanos' },
        _count: { empleados: 3 }
      }];

      //Simular que la base de datos devuelve un total de 1 cargo y la lista de cargos
      mockPrisma.cargo.count.mockResolvedValueOnce(1);
      mockPrisma.cargo.findMany.mockResolvedValueOnce(cargosSimulados);

      //Act: Ejecutar el caso de uso para listar cargos
      const resultado = await useCase.listar(query);

      //Assert: Verificar que el resultado contenga los datos esperados y la meta información de paginación
      expect(resultado).toEqual({
        data: [{
          id: 'cargo-1',
          id_area: 'area-1',
          nombre: 'Analista de Nóminas',
          descripcion: 'Cálculo de planillas',
          sueldo_minimo: 2000.0,
          sueldo_maximo: 4000.0,
          activo: true,
          area: { id: 'area-1', nombre: 'Recursos Humanos' },
          total_empleados: 3,
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
      });

      //Verificar que se llamaron los métodos de Prisma con los parámetros correctos para la consulta
      expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        skip: 0,
        take: 10,
        orderBy: { nombre: 'asc' },
        include: {
          area: { select: { id: true, nombre: true } },
          _count: { select: { empleados: { where: { activo: true, deleted_at: null } } } }
        }
      });
    });

    it('Debe calcular correctamente el skip y totalPages (page: 3, limit: 10 para 25 registros)', async () => {
      //Arrange: Simular que hay un total de 25 cargos y que se solicita la página 3 con un límite de 10 por página
      const query = { page: 3, limit: 10 } as ListarCargosQueryDto;

      //Configuración del mock para devolver un total de 25 cargos y una lista vacía para la página 3
      mockPrisma.cargo.count.mockResolvedValueOnce(25);
      mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar el caso de uso para listar cargos con la consulta de paginación
      const resultado = await useCase.listar(query);

      //Assert: Verificar que los metadatos de paginación son correctos y que se llamaron los métodos de Prisma con los parámetros correctos
      expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
      expect(resultado.meta).toEqual({ total: 25, page: 3, limit: 10, totalPages: 3 });
    });
  });

  describe('Filtros Dinámicos (search, id_area y activo)', () => {
    it('Debe filtrar por coincidencia de search en nombre o descripción (mode: insensitive)', async () => {
      //Arrange: Simular que se realiza una búsqueda por el término 'desarrollador'
      const query: ListarCargosQueryDto = {
        page: 1,
        limit: 10,
        search: 'desarrollador'
      };

      //Configuración del mock para devolver un total de 0 cargos y una lista vacía
      mockPrisma.cargo.count.mockResolvedValueOnce(0);
      mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar el caso de uso para listar cargos con el filtro de búsqueda
      await useCase.listar(query);

      //Assert: Verificar que se llamaron los métodos de Prisma con los parámetros correctos y que el filtro search se aplicó correctamente
      expect(mockPrisma.cargo.count).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          OR: [
            { nombre: { contains: 'desarrollador', mode: 'insensitive' } },
            { descripcion: { contains: 'desarrollador', mode: 'insensitive' } },
          ]
        }
      });
    });

    it('Debe combinar múltiples filtros (id_area y activo=false)', async () => {
      //Arrange: Simular que se filtra por un área específica y por cargos inactivos
      const query: ListarCargosQueryDto = {
        page: 1,
        limit: 50,
        id_area: 'area-uuid-1',
        activo: false
      };

      //Configuración del mock para devolver un total de 0 cargos y una lista vacía
      mockPrisma.cargo.count.mockResolvedValueOnce(0);
      mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar el caso de uso para listar cargos con los filtros combinados
      await useCase.listar(query);

      //Assert: Verificar que se llamaron los métodos de Prisma con los parámetros correctos y que los filtros se aplicaron correctamente
      expect(mockPrisma.cargo.count).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          id_area: 'area-uuid-1',
          activo: false
        }
      });
    });
  });

  describe('Manejo de Excepciones', () => {
    it('Debe transformar fallos inesperados de consulta a InternalServerErrorException', async () => {
      //Arrange: Simular que la base de datos lanza un error inesperado
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('PostgreSQL Connection Failure'));

      //Act & Assert: Verificar que se lanza la excepción de error interno y que se propaga correctamente
      await expect(useCase.listar({ page: 1, limit: 50 })).rejects.toThrow(InternalServerErrorException);
    });
  });
});