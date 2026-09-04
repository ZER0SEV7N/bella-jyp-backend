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

  const mockPrisma = {
    cargo: { count: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((queries: Promise<any>[]) => Promise.all(queries)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarCargosUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<ListarCargosUseCase>(ListarCargosUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Paginación por Defecto y Mapeo de Atributos', () => {
    it('Debe listar cargos con paginación por defecto e incluir área, bandas salariales y conteo de empleados', async () => {
      const query = {} as ListarCargosQueryDto;
      const cargosSimulados = [
        {
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
          _count: { empleados: 3 },
        },
      ];

      mockPrisma.cargo.count.mockResolvedValueOnce(1);
      mockPrisma.cargo.findMany.mockResolvedValueOnce(cargosSimulados);

      const resultado = await useCase.listar(query);

      expect(resultado).toEqual({
        data: [
          {
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
            updated_at: expect.any(Date),
          },
        ],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        skip: 0,
        take: 10,
        orderBy: { nombre: 'asc' },
        include: {
          area: { select: { id: true, nombre: true } },
          _count: { select: { empleados: { where: { activo: true, deleted_at: null } } } },
        },
      });
    });

    it('Debe calcular correctamente el skip y totalPages (page: 3, limit: 10 para 25 registros)', async () => {
      const query = { page: 3, limit: 10 } as ListarCargosQueryDto;

      mockPrisma.cargo.count.mockResolvedValueOnce(25);
      mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

      const resultado = await useCase.listar(query);

      expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
      expect(resultado.meta).toEqual({ total: 25, page: 3, limit: 10, totalPages: 3 });
    });
  });

  describe('Filtros Dinámicos (search, id_area y activo)', () => {
    it('Debe filtrar por coincidencia de search en nombre o descripción (mode: insensitive)', async () => {
      const query: ListarCargosQueryDto = {
        page: 1,
        limit: 10,
        search: 'desarrollador',
      };

      mockPrisma.cargo.count.mockResolvedValueOnce(0);
      mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

      await useCase.listar(query);

      expect(mockPrisma.cargo.count).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          OR: [
            { nombre: { contains: 'desarrollador', mode: 'insensitive' } },
            { descripcion: { contains: 'desarrollador', mode: 'insensitive' } },
          ],
        },
      });
    });

    it('Debe combinar múltiples filtros (id_area y activo=false)', async () => {
      const query: ListarCargosQueryDto = {
        page: 1,
        limit: 50,
        id_area: 'area-uuid-1',
        activo: false,
      };

      mockPrisma.cargo.count.mockResolvedValueOnce(0);
      mockPrisma.cargo.findMany.mockResolvedValueOnce([]);

      await useCase.listar(query);

      expect(mockPrisma.cargo.count).toHaveBeenCalledWith({
        where: {
          deleted_at: null,
          id_area: 'area-uuid-1',
          activo: false,
        },
      });
    });
  });

  describe('Manejo de Excepciones', () => {
    it('Debe transformar fallos inesperados de consulta a InternalServerErrorException', async () => {
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('PostgreSQL Connection Failure'));

      await expect(useCase.listar({ page: 1, limit: 50 })).rejects.toThrow(InternalServerErrorException);
    });
  });
});