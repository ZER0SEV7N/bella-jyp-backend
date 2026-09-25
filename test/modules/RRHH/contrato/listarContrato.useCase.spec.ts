import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ListarContratoUseCase } from '@/modules/RRHH/contrato/use-cases/listarContrato.useCase';
import type { ListarContratosQueryDto } from '@jyp/shared-contracts';

describe('ListarContratoUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: ListarContratoUseCase;
  let prismaService: PrismaService;

  const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';

  const mockPrismaService = {
    empleados: {
      findUnique: jest.fn(),
    },
    contratos: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarContratoUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    useCase = module.get<ListarContratoUseCase>(ListarContratoUseCase);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('execute()', () => {
    it('Debe listar los contratos ordenados descendentemente para un empleado activo', async () => {
      const query: ListarContratosQueryDto = {
        page: 1,
        limit: 10,
        empleado_id: mockEmpleadoId,
      };

      const mockEmpleado = {
        id: mockEmpleadoId,
        nombre: 'Carlos',
        apellido: 'Mendoza',
        nro_documento: '72345678',
      };

      // Estructura idéntica al include de Prisma: empleados (plural)
      const mockContratosList = [
        {
          id: '018f4a3c-7b2a-7123-8901-0123456789ad',
          empleado_id: mockEmpleadoId,
          tipo_modalidad: 'PLAZO_FIJO',
          fecha_inicio: new Date('2026-01-01'),
          fecha_fin: new Date('2026-12-31'),
          url: null,
          renovado: false,
          observacion: 'Contrato regular',
          empleados: {
            id: mockEmpleadoId,
            nombre: 'Carlos',
            apellido: 'Mendoza',
            nro_documento: '72345678',
            area: { id: 'area-1', nombre: 'Tecnología' },
            cargo: { id: 'cargo-1', nombre: 'Desarrollador' },
          },
          estado_contrato: { id: 'estado-1', nombre: 'ACTIVO' },
        },
      ];

      mockPrismaService.empleados.findUnique.mockResolvedValue(mockEmpleado);
      mockPrismaService.contratos.count.mockResolvedValue(1);
      mockPrismaService.contratos.findMany.mockResolvedValue(mockContratosList);

      const result = await useCase.execute(query);

      expect(prismaService.empleados.findUnique).toHaveBeenCalledWith({
        where: { id: mockEmpleadoId, deleted_at: null },
        select: { id: true, nombre: true, apellido: true, nro_documento: true },
      });
      expect(prismaService.contratos.findMany).toHaveBeenCalled();
      expect(prismaService.contratos.count).toHaveBeenCalled();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].colaborador).toBe('Carlos Mendoza');
      expect(result.data[0].nro_documento).toBe('72345678');
      expect(result.data[0].area).toBe('Tecnología');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('Debe listar contratos globales con filtro por_vencer_dias sin consultar empleado único', async () => {
      const query: ListarContratosQueryDto = {
        page: 1,
        limit: 10,
        por_vencer_dias: 30,
      };

      mockPrismaService.contratos.count.mockResolvedValue(0);
      mockPrismaService.contratos.findMany.mockResolvedValue([]);

      const result = await useCase.execute(query);

      expect(prismaService.empleados.findUnique).not.toHaveBeenCalled();
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('Debe lanzar NotFoundException si el empleado especificado en empleado_id no existe o fue eliminado', async () => {
      const query: ListarContratosQueryDto = {
        page: 1,
        limit: 10,
        empleado_id: mockEmpleadoId,
      };

      mockPrismaService.empleados.findUnique.mockResolvedValue(null);

      await expect(useCase.execute(query)).rejects.toThrow(NotFoundException);
    });

    it('Debe capturar errores no esperados y arrojar InternalServerErrorException', async () => {
      const query: ListarContratosQueryDto = {
        page: 1,
        limit: 10,
        empleado_id: mockEmpleadoId,
      };

      const mockEmpleado = {
        id: mockEmpleadoId,
        nombre: 'Carlos',
        apellido: 'Mendoza',
        nro_documento: '72345678',
      };

      mockPrismaService.empleados.findUnique.mockResolvedValue(mockEmpleado);
      mockPrismaService.contratos.count.mockRejectedValue(new Error('DB Connection Timeout'));

      await expect(useCase.execute(query)).rejects.toThrow(InternalServerErrorException);
    });
  });
});