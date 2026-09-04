//test/modules/RRHH/organizacion/jornadas/listarJornada.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ListarJornadaUseCase } from '@/modules/RRHH/organizacion/use-cases/jornadas/listarJornada.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarJornadasQueryDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias para el caso de uso ListarJornadaUseCase, enfocadas en la paginación y los filtros.
 * Se simula el comportamiento del servicio PrismaService para verificar que el caso de uso maneje correctamente
 * la lógica de paginación, cálculo de skip, totalPages y la aplicación de filtros por tipo de jornada y estado activo.
 * Además, se valida que las excepciones sean propagadas adecuadamente en caso
 */
describe('ListarJornadaUseCase - Pruebas Unitarias', () => {
  let useCase: ListarJornadaUseCase;
  let prisma: PrismaService;

  //Mock del servicio PrismaService para simular la interacción con la base de datos
  const mockPrisma = {
    jornada: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    $transaction: jest.fn((queries: Promise<any>[]) => Promise.all(queries)),
  };

  //Datos de prueba para una jornada existente
  const jornadaMock = {
    id: 'jornada-1',
    nombre: 'Turno Mañana (Oficina)',
    descripcion: 'Horario estándar',
    duracion: 'TIEMPO_COMPLETO',
    turno: 'MANANA',
    modalidad: 'PRESENCIAL',
    tolerancia_minutos: 15,
    total_horas_semana: 40.0,
    horario_semanal: [],
    patron_rotacion: null,
    activo: true,
    _count: {
      empleados: 12,
      jornada_areas: 2
    },
    jornada_areas: [
      { area: { id: 'area-1', nombre: 'Administración' } },
      { area: { id: 'area-2', nombre: 'Contabilidad' } }
    ],
  };

  //Configuración de pruebas antes de cada caso
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarJornadaUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<ListarJornadaUseCase>(ListarJornadaUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  //Limpiar los mocks después de cada prueba para evitar interferencias entre casos
  afterEach(() => jest.clearAllMocks());

  describe('Paginación y Mapeo Estructurado', () => {
    it('Debe listar jornadas con paginación por defecto y formatear total_empleados y áreas', async () => {
      //Arrange: Configurar el mock para devolver un total de 1 jornada y la jornada de prueba
      const query = {} as ListarJornadasQueryDto;

      //Simular la respuesta de Prisma para count y findMany
      mockPrisma.jornada.count.mockResolvedValueOnce(1);
      mockPrisma.jornada.findMany.mockResolvedValueOnce([jornadaMock]);

      //Act: Ejecutar el caso de uso con la consulta de prueba
      const resultado = await useCase.execute(query);

      //Assert: Verificar que el resultado contenga la jornada mapeada correctamente y la meta de paginación
      expect(resultado.data).toEqual([ expect.objectContaining({
        id: 'jornada-1',
        nombre: 'Turno Mañana (Oficina)',
        total_horas_semana: 40,
        total_empleados: 12,
        total_areas: 2,
        areas: [
          { id: 'area-1', nombre: 'Administración' },
          { id: 'area-2', nombre: 'Contabilidad' }
        ]
      })]);

      //Verificar que la meta de paginación sea correcta con los valores predeterminados
      expect(resultado.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      });

      //Verificar que se llamó a findMany con los parámetros correctos
      expect(mockPrisma.jornada.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: {
              empleados: { where: { activo: true, deleted_at: null } },
              jornada_areas: true
            }
          },
          jornada_areas: { include: { area: { select: { id: true, nombre: true } } } }
        }
      });
    });

    it('Debe calcular correctamente el skip y totalPages para page: 2, limit: 15', async () => {
      //Arrange: Configurar el mock para devolver un total de 35 jornadas y una página vacía
      const query = { page: 2, limit: 15 } as ListarJornadasQueryDto;

      //Simular la respuesta de Prisma para count y findMany
      mockPrisma.jornada.count.mockResolvedValueOnce(35);
      mockPrisma.jornada.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar el caso de uso con la consulta de prueba
      const resultado = await useCase.execute(query);

      //Assert: Verificar que se haya calculado correctamente el skip y totalPages
      expect(mockPrisma.jornada.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 15, take: 15 }));
      expect(resultado.meta).toEqual({ total: 35, page: 2, limit: 15, totalPages: 3 });
    });
  });

  describe('Filtros Avanzados (Área, Modalidad, Turno, Search)', () => {
    it('Debe filtrar por área a través de la tabla pivote jornada_areas', async () => {
      //Arrange: Configurar el mock para devolver un total de 0 jornadas y una lista vacía
      const query = { area_id: 'area-uuid-123' } as ListarJornadasQueryDto;

      //Simular la respuesta de Prisma para count y findMany
      mockPrisma.jornada.count.mockResolvedValueOnce(0);
      mockPrisma.jornada.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar el caso de uso con la consulta de prueba
      await useCase.execute(query);

      //Assert: Verificar que se haya aplicado el filtro por área correctamente en la consulta
      expect(mockPrisma.jornada.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({jornada_areas: { some: { area_id: 'area-uuid-123' } } })
      }));
    });

    it('Debe aplicar filtro de búsqueda insensitive por nombre o descripción', async () => {
      //Arrange: Configurar el mock para devolver un total de 0 jornadas y una lista vacía
      const query = { search: 'Noche' } as ListarJornadasQueryDto;

      //Simular la respuesta de Prisma para count y findMany
      mockPrisma.jornada.count.mockResolvedValueOnce(0);
      mockPrisma.jornada.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar el caso de uso con la consulta de prueba
      await useCase.execute(query);
    
      //Assert: Verificar que se haya aplicado el filtro de búsqueda correctamente en la consulta
      expect(mockPrisma.jornada.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { nombre: { contains: 'Noche', mode: 'insensitive' } },
            { descripcion: { contains: 'Noche', mode: 'insensitive' } }
          ]})
      }));
    });

    it('Debe filtrar por modalidad HIBRIDO y turno ROTATIVO', async () => {
      //Arrange: Configurar el mock para devolver un total de 0 jornadas y una lista vacía
      const query = { modalidad: 'HIBRIDO', turno: 'ROTATIVO' } as ListarJornadasQueryDto;

      //Simular la respuesta de Prisma para count y findMany
      mockPrisma.jornada.count.mockResolvedValueOnce(0);
      mockPrisma.jornada.findMany.mockResolvedValueOnce([]);

      //Act: Ejecutar el caso de uso con la consulta de prueba
      await useCase.execute(query);

      //Assert: Verificar que se hayan aplicado los filtros de modalidad y turno correctamente en la consulta
      expect(mockPrisma.jornada.findMany).toHaveBeenCalledWith( expect.objectContaining({
        where: expect.objectContaining({
          modalidad: 'HIBRIDO',
          turno: 'ROTATIVO'
        })
      }));
    });
  });

  describe('Manejo de Errores', () => {
    it('Debe propagar InternalServerErrorException si la transacción falla', async () => {
      //Arrange: Configurar el mock para simular un error en la trans
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('PostgreSQL timeout'));

      //Act & Assert: Ejecutar el caso de uso y esperar que lance InternalServerErrorException
      await expect(useCase.execute({} as ListarJornadasQueryDto)).rejects.toThrow(InternalServerErrorException);
    });
  });
});