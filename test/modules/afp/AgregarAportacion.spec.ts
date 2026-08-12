import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { AgregarAportacionUseCase } from '@/modules/payroll/afp/use-cases/aportacion/agregarAportacion.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

jest.mock('@/common/utils/uuid.util', () => ({
    IdentityGenerator: { generateId: jest.fn(() => 'uuid-aportacion-123') }
}));

describe('AgregarAportacionUseCase', () => {
    let useCase: AgregarAportacionUseCase;
    let mockPrisma: any;

    beforeEach(async () => {
        mockPrisma = {
            tipo_afp: { findUnique: jest.fn() },
            aportaciones: { create: jest.fn() }
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AgregarAportacionUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<AgregarAportacionUseCase>(AgregarAportacionUseCase);
    });

    afterEach(() => jest.clearAllMocks());

    it('Debería registrar la aportación si la AFP existe', async () => {
        const payload = { afp_id: 'afp-1', nombre: 'Fondo Mutuo', cantidad: 100 };
        mockPrisma.tipo_afp.findUnique.mockResolvedValue({ id: 'afp-1' });
        mockPrisma.aportaciones.create.mockResolvedValue({ id: 'uuid-aportacion-123', ...payload });

        const result = await useCase.execute(payload as any);

        expect(result.id).toBe('uuid-aportacion-123');
        expect(mockPrisma.aportaciones.create).toHaveBeenCalled();
    });

    it('Debería lanzar NotFoundException si la AFP enviada no existe', async () => {
        const payload = { afp_id: 'afp-404', nombre: 'Fondo', cantidad: 100 };
        mockPrisma.tipo_afp.findUnique.mockResolvedValue(null);

        await expect(useCase.execute(payload as any)).rejects.toThrow(NotFoundException);
        expect(mockPrisma.aportaciones.create).not.toHaveBeenCalled();
    });

    it('Debería lanzar InternalServerErrorException si ocurre un error de BD', async () => {
        mockPrisma.tipo_afp.findUnique.mockResolvedValue({ id: 'afp-1' });
        mockPrisma.aportaciones.create.mockRejectedValue(new Error('Fallo DB'));

        await expect(useCase.execute({ afp_id: 'afp-1' } as any)).rejects.toThrow(InternalServerErrorException);
    });
});
