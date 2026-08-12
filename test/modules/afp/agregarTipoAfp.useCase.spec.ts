import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AgregarTipoAfpUseCase } from '@/modules/afp/use-cases/tipo-afp/agregarTipoAfp.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

jest.mock('@/common/utils/uuid.util', () => ({
    IdentityGenerator: { generateId: jest.fn(() => 'uuid-tipo-afp-123') },
}));

describe('AgregarTipoAfpUseCase', () => {
    let useCase: AgregarTipoAfpUseCase;
    let mockPrisma: any;

    beforeEach(async () => {
        mockPrisma = {
        regimen_pension: { findUnique: jest.fn() },
        tipo_afp: { findFirst: jest.fn(), create: jest.fn() },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AgregarTipoAfpUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<AgregarTipoAfpUseCase>(AgregarTipoAfpUseCase);
    });

    afterEach(() => jest.clearAllMocks());

    it('Debería crear una AFP correctamente', async () => {
        const payload = { nombre: 'AFP Integra', id_regimen: 'uuid-regimen' };
        
        // 1. El régimen existe y su nombre contiene "AFP"
        mockPrisma.regimen_pension.findUnique.mockResolvedValue({ id: 'uuid-regimen', nombre: 'AFP (Sistema Privado)' });
        // 2. No hay otra AFP con el mismo nombre
        mockPrisma.tipo_afp.findFirst.mockResolvedValue(null);
        // 3. Simula creación
        mockPrisma.tipo_afp.create.mockResolvedValue({ id: 'uuid-tipo-afp-123', ...payload });

        const result = await useCase.execute(payload as any);

        expect(result.id).toBe('uuid-tipo-afp-123');
        expect(mockPrisma.tipo_afp.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nombre: 'AFP Integra' })
        });
    });

    it('Debería lanzar BadRequestException si el régimen no existe o no es de tipo AFP', async () => {
        const payload = { nombre: 'AFP Integra', id_regimen: 'uuid-regimen' };
        
        // Simula que el usuario envió el ID del régimen "ONP"
        mockPrisma.regimen_pension.findUnique.mockResolvedValue({ id: 'uuid-regimen', nombre: 'ONP (Sistema Nacional)' });

        await expect(useCase.execute(payload as any)).rejects.toThrow(BadRequestException);
        await expect(useCase.execute(payload as any)).rejects.toMatchObject({
            response: expect.objectContaining({
                "detail": "El régimen de pensión seleccionado no existe o no corresponde a un sistema AFP."
            })
        });
        expect(mockPrisma.tipo_afp.create).not.toHaveBeenCalled();
    });

    it('Debería lanzar BadRequestException si el nombre de la AFP ya existe', async () => {
        const payload = { nombre: 'AFP Integra', id_regimen: 'uuid-regimen' };
        mockPrisma.regimen_pension.findUnique.mockResolvedValue({ id: 'uuid-regimen', nombre: 'AFP' });
        
        // Encuentra un duplicado
        mockPrisma.tipo_afp.findFirst.mockResolvedValue({ id: 'otra-afp', nombre: 'AFP Integra' });

        await expect(useCase.execute(payload as any)).rejects.toThrow(BadRequestException);
        await expect(useCase.execute(payload as any)).rejects.toMatchObject({
            response: expect.objectContaining({
                title: 'AFP Duplicada'
            })
        });
    });

    it('Debería lanzar InternalServerErrorException si la base de datos falla al guardar', async () => {
        mockPrisma.regimen_pension.findUnique.mockResolvedValue({ id: 'uuid-regimen', nombre: 'AFP' });
        mockPrisma.tipo_afp.findFirst.mockResolvedValue(null);
        mockPrisma.tipo_afp.create.mockRejectedValue(new Error('DB Error'));

        await expect(useCase.execute({ nombre: 'Test', id_regimen: '123' } as any)).rejects.toThrow(InternalServerErrorException);
    });
});
