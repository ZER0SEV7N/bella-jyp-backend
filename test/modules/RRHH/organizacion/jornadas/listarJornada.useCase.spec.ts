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
describe('ListarJornadaUseCase - Pruebas Unitarias de Paginación y Filtros', () => {
  let useCase: ListarJornadaUseCase;
  let prisma: PrismaService;

  //Mock del servicio PrismaService para simular la interacción con la base de datos
  const mockPrisma = {
    jornada: {count: jest.fn(), findMany: jest.fn()},
    $transaction: jest.fn((queries: Promise<any>[]) => Promise.all(queries))
  };

  //Configuración del módulo de pruebas antes de cada test
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

  afterEach(() => jest.clearAllMocks());

  describe('Paginación por Defecto y Cálculo de Skip', () => {
    it('Debe listar jornadas con paginación por defecto (page: 1, limit: 50) e incluir contadores', async () => {
      //Arrange: Se define la consulta con los parámetros por defecto y se simula la respuesta de PrismaService
      const query = {} as ListarJornadasQueryDto;
      const jornadasSimuladas = [{
        id: 'jornada-1',
        nombre: 'Turno Mañana (Oficina)',
        tipo_jornada: 'FIJA',
        hora_entrada: new Date('1970-01-01T08:00:00.000Z'),
        hora_salida: new Date('1970-01-01T17:00:00.000Z'),
        tolerancia_minutos: 15,
        activo: true,
        _count: { empleados: 12, cargos_sugeridos: 3 }
      }];

      //Act: Se simula la respuesta de PrismaService para count y findMany
      mockPrisma.jornada.count.mockResolvedValueOnce(1);
      mockPrisma.jornada.findMany.mockResolvedValueOnce(jornadasSimuladas);

      const resultado = await useCase.execute(query);

      //Assert: Se verifica que el resultado contenga los datos esperados y 
      //que se haya llamado a PrismaService con los parámetros correctos
      expect(resultado).toEqual({
        data: jornadasSimuladas,
        meta: {total: 1, page: 1, limit: 50, totalPages: 1}
      });

      expect(mockPrisma.jornada.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
        skip: 0,
        take: 50,
        orderBy: { nombre: 'asc' },
        include: { _count: {
          select: {
            empleados: { where: { activo: true, deleted_at: null } },
            cargos_sugeridos: { where: { activo: true, deleted_at: null } }
          }
        }}
      });
    });

    it('Debe calcular correctamente el skip y totalPages (page: 2, limit: 15)', async () => {
      //Arrange: Se define la consulta con page=2 y limit=15, y se simula la respuesta de PrismaService
      const query = { page: 2, limit: 15 } as ListarJornadasQueryDto;

      //Act: Se simula la respuesta de PrismaService para count y findMany
      mockPrisma.jornada.count.mockResolvedValueOnce(40);
      mockPrisma.jornada.findMany.mockResolvedValueOnce([]);

      const resultado = await useCase.execute(query);

      //Assert: Se verifica que el resultado contenga los datos esperados y
      //que se haya llamado a PrismaService con los parámetros correctos
      expect(mockPrisma.jornada.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 15, take: 15 }),);
      expect(resultado.meta).toEqual({total: 40, page: 2, limit: 15, totalPages: 3 }); // Math.ceil(40 / 15) = 3
    });
  });

  describe('Filtros por Tipo de Jornada y Estado Activo', () => {
    it('Debe filtrar por tipo_jornada cuando se especifica en la consulta (ROTATIVA)', async () => {
      //Arrange: Se define la consulta con tipo_jornada=ROTATIVA y se simula la respuesta de PrismaService
      const query = { tipo_jornada: 'ROTATIVA' } as ListarJornadasQueryDto;

      //Mock de PrismaService para count y findMany
      mockPrisma.jornada.count.mockResolvedValueOnce(0);
      mockPrisma.jornada.findMany.mockResolvedValueOnce([]);

      //Act: Se ejecuta el caso de uso con la consulta
      await useCase.execute(query);

      //Assert: Se verifica que PrismaService haya sido llamado con los filtros correctos
      expect(mockPrisma.jornada.count).toHaveBeenCalledWith({where: { deleted_at: null, tipo_jornada: 'ROTATIVA' }});
      expect(mockPrisma.jornada.findMany).toHaveBeenCalledWith(expect.objectContaining({where: { deleted_at: null, tipo_jornada: 'ROTATIVA' }}));
    });

    it('Debe filtrar por activo=false cuando se solicita explícitamente', async () => {
      //Arrange: Se define la consulta con activo=false y se simula la respuesta de PrismaService
      const query = { activo: false } as ListarJornadasQueryDto;

      //Act: Se simula la respuesta de PrismaService para count y findMany
      mockPrisma.jornada.count.mockResolvedValueOnce(0);
      mockPrisma.jornada.findMany.mockResolvedValueOnce([]);

      await useCase.execute(query);

      //Assert: Se verifica que PrismaService haya sido llamado con los filtros correctos
      expect(mockPrisma.jornada.count).toHaveBeenCalledWith({where: { deleted_at: null, activo: false }});
      expect(mockPrisma.jornada.findMany).toHaveBeenCalledWith(expect.objectContaining({where: { deleted_at: null, activo: false }}));
    });

    it('Debe combinar múltiples filtros (tipo_jornada=PART_TIME y activo=true)', async () => {
      //Arrange: Se define la consulta con tipo_jornada=PART_TIME y activo=true
      const query = {tipo_jornada: 'PART_TIME', activo: true} as ListarJornadasQueryDto;

      //Act: Se simula la respuesta de PrismaService para count y findMany
      mockPrisma.jornada.count.mockResolvedValueOnce(0);
      mockPrisma.jornada.findMany.mockResolvedValueOnce([]);

      await useCase.execute(query);

      //Assert: Se verifica que PrismaService haya sido llamado con los filtros correctos
      expect(mockPrisma.jornada.count).toHaveBeenCalledWith({where: { deleted_at: null, tipo_jornada: 'PART_TIME', activo: true }});
    });
  });

  describe('Manejo de Excepciones', () => {
    it('Debe propagar InternalServerErrorException si la transacción de consulta falla', async () => {
      //Arrange: Se simula un fallo en la transacción de PrismaService
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('Fallo de conexión en BD'));

      //Act & Assert: Se espera que el caso de uso propague la excepción como InternalServerErrorException
      await expect(useCase.execute({ page: 1, limit: 50 } as ListarJornadasQueryDto)).rejects.toThrow(InternalServerErrorException);
    });
  });
});