import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ListarDerechohabientesUseCase } from '@/modules/RRHH/organizacion/use-cases/derechohabiente/listarDerechohabientes.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

describe('ListarDerechohabientesUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: ListarDerechohabientesUseCase;
  let prisma: PrismaService;

  const mockPrisma = {
    derechohabientes: { findMany: jest.fn() },
  };

  const empleadoId = '018f4a7c-9999-7000-3333-000000000002';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarDerechohabientesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<ListarDerechohabientesUseCase>(ListarDerechohabientesUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe retornar la lista de derechohabientes activos incluyendo sustentos vigentes', async () => {
      // Arrange
      const mockFamiliares = [
        {
          id: 'dh-1',
          empleado_id: empleadoId,
          nombres: 'Mateo',
          apellidos: 'Ramírez Vargas',
          vinculo: 'HIJO_MENOR',
          tipo_documento: { id: 'tdoc-1', tipo_documento: 'DNI' },
          documentos: [
            {
              id: 'doc-1',
              tipo_documento: 'PARTIDA_NACIMIENTO',
              nombre_archivo: 'partida.pdf',
              archivo_url: '/archivos/derechohabientes/partida.pdf',
              fecha_emision: null,
              fecha_vencimiento: null,
              created_at: new Date(),
              vigente: true,
            },
          ],
        },
      ];

      mockPrisma.derechohabientes.findMany.mockResolvedValue(mockFamiliares);

      // Act
      const result = await useCase.listarPorEmpleado(empleadoId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].nombres).toBe('Mateo');
      expect(result[0].documentos).toHaveLength(1);
      expect(mockPrisma.derechohabientes.findMany).toHaveBeenCalledWith({
        where: { empleado_id: empleadoId, deleted_at: null },
        include: {
          tipo_documento: { select: { id: true, tipo_documento: true } },
          documentos: {
            where: { deleted_at: null },
            select: {
              id: true,
              tipo_documento: true,
              archivo_url: true,
              fecha_emision: true,
              fecha_vencimiento: true,
              created_at: true
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe capturar errores del motor de base de datos y lanzar InternalServerErrorException', async () => {
      // Arrange
      mockPrisma.derechohabientes.findMany.mockRejectedValue(new Error('PostgreSQL Query Timeout'));

      // Act & Assert
      await expect(useCase.listarPorEmpleado(empleadoId)).rejects.toThrow(InternalServerErrorException);
    });
  });
});