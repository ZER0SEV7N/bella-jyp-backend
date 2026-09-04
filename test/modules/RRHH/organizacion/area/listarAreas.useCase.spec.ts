//test/modules/RRHH/organizacion/area/listarAreas.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ListarAreasUseCase } from '@/modules/RRHH/organizacion/use-cases/area/listarAreas.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarAreasQueryDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el caso de uso ListarAreasUseCase.
 * Estas pruebas verifican el comportamiento del caso de uso en escenarios de éxito y manejo de errores.
 * Se simula la interacción con la base de datos utilizando un mock del servicio Prisma.
 */
describe('ListarAreasUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: ListarAreasUseCase;
  let prisma: PrismaService;

  //Mock del servicio Prisma para simular la interacción con la base de datos
  const mockPrisma = {
    area: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    $transaction: jest.fn(async (queries) => Promise.all(queries)),
  };

  //Datos de prueba para un área existente
  const areaMock = {
    id: '018f4a7c-area-0000-0000-000000000001',
    nombre: 'Administración y Finanzas',
    descripcion: 'Gestión corporativa',
    activo: true,
    deleted_at: null,
    _count: {
      cargo: 4,
      empleados: 12,
      jornada_areas: 2
    }
  };

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarAreasUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<ListarAreasUseCase>(ListarAreasUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Paginación y Mapeo de Contadores', () => {
    it('Debe listar áreas con paginación por defecto y formatear contadores de cargos, empleados y jornadas', async () => {
      //Arrange: Simular que hay un área existente y que la consulta devuelve un total de 1
      const query = {} as ListarAreasQueryDto;

      //Configuración del mock para devolver un total de 1 área y la lista de áreas
      mockPrisma.area.count.mockResolvedValueOnce(1);
      mockPrisma.area.findMany.mockResolvedValueOnce([areaMock]);

      //Act: Ejecutar el caso de uso para listar áreas
      const result = await useCase.listar(query);

      //Assert: Verificar que el resultado contiene los datos esperados y que se llamaron los métodos de Prisma con los parámetros correctos
      expect(result.data).toEqual([
        {
          id: '018f4a7c-area-0000-0000-000000000001',
          nombre: 'Administración y Finanzas',
          descripcion: 'Gestión corporativa',
          activo: true,
          total_cargos: 4,
          total_empleados: 12,
          total_jornadas: 2
        }
      ]);
      //Verificar que los metadatos de paginación son correctos
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      });
      //Verificar que se llamaron los métodos de Prisma con los parámetros correctos para la consulta
      expect(prisma.area.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        skip: 0,
        take: 10,
        orderBy: { nombre: 'asc' },
        include: {
          _count: {
            select: {
              cargo: { where: { deleted_at: null, activo: true } },
              empleados: { where: { deleted_at: null, activo: true } },
              jornada_areas: true
            }
          }
        }
      });
    });

    it('Debe calcular correctamente el skip y totalPages (page: 3, limit: 5 para 14 registros)', async () => {
      //Arrange: Simular que hay un total de 14 áreas y que se solicita la página 3 con un límite de 5 por página
      const query: ListarAreasQueryDto = { page: 3, limit: 5 };

      //Configuración del mock para devolver un total de 14 áreas y una lista vacía para la página 3
      mockPrisma.area.count.mockResolvedValueOnce(14);
      mockPrisma.area.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar el caso de uso para listar áreas con la consulta de paginación
      const result = await useCase.listar(query);

      //Assert: Verificar que los metadatos de paginación son correctos y que se llamaron los métodos de Prisma con los parámetros correctos
      expect(result.meta).toEqual({ total: 14, page: 3, limit: 5, totalPages: 3 });
      expect(prisma.area.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
    });
  });

  describe('Filtros Dinámicos (search y activo)', () => {
    it('Debe aplicar el filtro search insensible a mayúsculas en nombre y descripción', async () => {
      //Arrange: Simular que se proporciona un término de búsqueda y que no hay áreas que coincidan
      const query: ListarAreasQueryDto = { page: 1, limit: 10, search: 'finanzas' };

      //Configuración del mock para devolver un total de 0 áreas y una lista vacía
      mockPrisma.area.count.mockResolvedValueOnce(0);
      mockPrisma.area.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar el caso de uso para listar áreas con el filtro de búsqueda
      await useCase.listar(query);

      //Assert: Verificar que se llamaron los métodos de Prisma con los parámetros correctos y que el filtro search se aplicó correctamente
      expect(prisma.area.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { nombre: { contains: 'finanzas', mode: 'insensitive' } },
            { descripcion: { contains: 'finanzas', mode: 'insensitive' } }
          ]
        })})
      );
    });

    it('Debe filtrar por activo=false cuando se requiere áreas inactivas', async () => {
      //Arrange: Simular que se solicita filtrar por áreas inactivas (activo=false)
      const query: ListarAreasQueryDto = { page: 1, limit: 10, activo: false };

      //Configuración del mock para devolver un total de 0 áreas y una lista vacía
      mockPrisma.area.count.mockResolvedValueOnce(0);
      mockPrisma.area.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar el caso de uso para listar áreas con el filtro de activo
      await useCase.listar(query);

      //Assert: Verificar que se llamaron los métodos de Prisma con los parámetros correctos y que el filtro activo se aplicó correctamente
      expect(prisma.area.count).toHaveBeenCalledWith({ where: { deleted_at: null, activo: false } });
    });
  });

  describe('Manejo de Excepciones', () => {
    it('Debe propagar InternalServerErrorException si la transacción en PostgreSQL falla', async () => {
      //Arrange: Simular un fallo en la transacción de Prisma para provocar un error interno
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('Transaction Timeout'));

      //Act & Assert: Verificar que se lanza la excepción de error interno y que se propaga correctamente
      await expect(useCase.listar({} as ListarAreasQueryDto)).rejects.toThrow( InternalServerErrorException );
    });
  });
});