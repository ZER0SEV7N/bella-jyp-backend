import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ListarAportacionesUseCase } from '@/modules/payroll/afp/use-cases/aportacion/listarAportacion.useCase';
import type { ListarAportacionesQueryDto } from '@jyp/shared-contracts';

describe('ListarAportacionesUseCase - Pruebas Unitarias de Paginación y Filtros', () => {
    let useCase: ListarAportacionesUseCase;

    const mockPrisma = {
        aportaciones: { count: jest.fn(), findMany: jest.fn()},
        $transaction: jest.fn((queries: Promise<any>[]) => Promise.all(queries)),
    };

    const mockAfpId = '018f4a7c-5555-7000-e000-000000000001';

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ListarAportacionesUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<ListarAportacionesUseCase>(ListarAportacionesUseCase);
    });

    afterEach(() => jest.clearAllMocks());

    describe('listar() - Consultas Generales y Filtrado por afp_id', () => {
        it('Happy Path: Debe listar aportaciones sin filtros aplicando paginación básica', async () => {
            const query: ListarAportacionesQueryDto = { page: 1, limit: 10 };

            const mockAportaciones = [{
                id: 'aportacion-uuid-1',
                afp_id: mockAfpId,
                nombre: 'Fondo de Jubilación Obligatorio',
                cantidad: 10.0,
                tipo_afp: { nombre: 'AFP INTEGRA' }
            }];

            mockPrisma.aportaciones.count.mockResolvedValueOnce(1);
            mockPrisma.aportaciones.findMany.mockResolvedValueOnce(mockAportaciones);

            const result = await useCase.listar(query);

            expect(mockPrisma.aportaciones.count).toHaveBeenCalledWith({ where: {} });
            expect(mockPrisma.aportaciones.findMany).toHaveBeenCalledWith({
                where: {},
                skip: 0,
                take: 10,
                orderBy: { nombre: 'desc' },
                include: { tipo_afp: { select: { nombre: true } } }
            });

            expect(result).toEqual({
                data: mockAportaciones,
                meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
            });
        });

        it('Happy Path: Debe filtrar por afp_id cuando se provee en los queryParams', async () => {
            const query: ListarAportacionesQueryDto = {
                page: 1,
                limit: 10,
                afp_id: mockAfpId,
            };

            mockPrisma.aportaciones.count.mockResolvedValueOnce(1);
            mockPrisma.aportaciones.findMany.mockResolvedValueOnce([]);

            await useCase.listar(query);

            expect(mockPrisma.aportaciones.count).toHaveBeenCalledWith({ where: { afp_id: mockAfpId }});
            expect(mockPrisma.aportaciones.findMany).toHaveBeenCalledWith(expect.objectContaining({where: { afp_id: mockAfpId }}));
        });

        it('Happy Path: Debe calcular skip adecuadamente para la página 3 con límite 15', async () => {
            const query: ListarAportacionesQueryDto = { page: 3, limit: 15 };

            mockPrisma.aportaciones.count.mockResolvedValueOnce(45);
            mockPrisma.aportaciones.findMany.mockResolvedValueOnce([]);

            const result = await useCase.listar(query);

            expect(mockPrisma.aportaciones.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 30, take: 15 }));
            expect(result.meta.totalPages).toBe(3);
        });
    });
});