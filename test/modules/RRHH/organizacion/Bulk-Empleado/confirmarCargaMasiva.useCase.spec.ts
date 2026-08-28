//test/modules/RRHH/organizacion/Bulk-Empleado/confirmarCargaMasiva.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfirmarCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/confirmarCargaMasiva.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException } from '@nestjs/common';

/**
 * Pruebas unitarias para el ConfirmarCargaMasivaUseCase.
 * Se utilizan mocks para simular el comportamiento de los servicios externos y casos de uso,
 * permitiendo verificar que el caso de uso se ejecute correctamente bajo diferentes escenarios.
 */
describe('ConfirmarCargaMasivaUseCase - Pruebas Unitarias', () => {
    let useCase: ConfirmarCargaMasivaUseCase;

    //Mocks de los servicios utilizados por el caso de uso
    const mockQueue = {add: jest.fn().mockResolvedValue(true)};
    const mockPrismaService = {cargaMasivaJob: {create: jest.fn().mockResolvedValue({ id: 'job-confirm-1' })}};

    //Configuración inicial antes de cada prueba
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConfirmarCargaMasivaUseCase,
                { provide: getQueueToken('rrhh-bulk-queue'), useValue: mockQueue },
                { provide: PrismaService, useValue: mockPrismaService }
            ]
        }).compile();

        //Obtenemos la instancia del caso de uso a probar
        useCase = module.get<ConfirmarCargaMasivaUseCase>(ConfirmarCargaMasivaUseCase);
    });

    afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba para evitar interferencias entre pruebas

    describe('execute() - Encolamiento de Filas Confirmadas', () => {
        it('Debe aceptar payload con clave "filas_validas_data", crear Job y encolar lotes', async () => {
            //Arrange: Simulamos un payload válido con filas confirmadas
            const payload = {
                filas_validas_data: [{
                    tipo_documento: 'DNI',
                    nro_documento: '70998877',
                    nombre: 'Roberto',
                    apellido: 'Flores Gomez'
                }]
            };

            //Act: Ejecutamos el caso de uso con un usuarioId y el payload simulado
            const result = await useCase.execute('usr-uuid-123', payload);

            //Assert: Verificamos que se haya creado un Job en la base de datos y que se haya encolado correctamente
            expect(mockPrismaService.cargaMasivaJob.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    usuario_id: 'usr-uuid-123',
                    total_registros: 1,
                    estado: 'EN_COLA'
            })}));
            expect(mockQueue.add).toHaveBeenCalled();
            expect(result).toHaveProperty('jobId');
        });

        it('Debe lanzar BadRequestException si el payload de filas confirmadas esta vacio', async () => {
            await expect(useCase.execute('usr-uuid-123', {})).rejects.toThrow(BadRequestException);
        });

        
    });
});