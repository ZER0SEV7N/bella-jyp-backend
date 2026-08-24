import { Test, TestingModule } from '@nestjs/testing';
import { ConfirmarCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/confirmarCargaMasiva.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException } from '@nestjs/common';

describe('ConfirmarCargaMasivaUseCase - Pruebas Unitarias', () => {
    let useCase: ConfirmarCargaMasivaUseCase;

    const mockQueue = {add: jest.fn().mockResolvedValue(true)};

    const mockPrismaService = {
        cargaMasivaJob: {
        create: jest.fn().mockResolvedValue({ id: 'job-confirm-1' }),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConfirmarCargaMasivaUseCase,
                { provide: getQueueToken('rrhh-bulk-queue'), useValue: mockQueue },
                { provide: PrismaService, useValue: mockPrismaService }
            ]
        }).compile();

        useCase = module.get<ConfirmarCargaMasivaUseCase>(ConfirmarCargaMasivaUseCase);
        jest.clearAllMocks();
    });

    describe('execute() - Encolamiento de Filas Confirmadas', () => {
        it('Debe aceptar payload con clave "filas_validas_data", crear Job y encolar lotes', async () => {
            const payload = {
                filas_validas_data: [{
                    tipo_documento: 'DNI',
                    nro_documento: '70998877',
                    nombre: 'Roberto',
                    apellido: 'Flores Gomez'
                }]
            };

            const result = await useCase.execute('usr-uuid-123', payload);

            expect(mockPrismaService.cargaMasivaJob.create).toHaveBeenCalledWith(
                expect.objectContaining({
                data: expect.objectContaining({
                    usuario_id: 'usr-uuid-123',
                    total_registros: 1,
                    estado: 'EN_COLA',
                }),
                }),
            );
            expect(mockQueue.add).toHaveBeenCalled();
            expect(result).toHaveProperty('jobId');
        });

        it('Debe lanzar BadRequestException si el payload de filas confirmadas esta vacio', async () => {
            await expect(useCase.execute('usr-uuid-123', {})).rejects.toThrow(BadRequestException);
        });

        
    });
});