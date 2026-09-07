//test/modules/RRHH/solicitudes/evaluarSolicitud.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EvaluarSolicitudUseCase } from '@/modules/RRHH/solicitudes/use-cases/evaluarSolicitud.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { EvaluarSolicitudDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias para el caso de uso EvaluarSolicitudUseCase.
 * Estas pruebas verifican la correcta evaluación de solicitudes, incluyendo la aprobación y rechazo,
 * la validación de observaciones y el manejo de excepciones.
 * Se utilizan mocks para simular la interacción con la base de datos a través de PrismaService.
 */
describe('EvaluarSolicitudUseCase - Pruebas Unitarias', () => {
    let useCase: EvaluarSolicitudUseCase;
    let prisma: PrismaService;

    //Mocks de PrismaService para simular la base de datos
    const mockPrisma = { solicitud: { findUnique: jest.fn(), update: jest.fn() } };

    //Datos de prueba para una solicitud ficticia y un evaluador
    const idSolicitud = 'sol-uuid-1';
    const idEvaluador = 'user-evaluador-id';

    //Configuración inicial de las pruebas, creando un módulo de prueba y obteniendo instancias de los casos de uso y servicios
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EvaluarSolicitudUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<EvaluarSolicitudUseCase>(EvaluarSolicitudUseCase);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => jest.clearAllMocks());

    it('Happy Path: Debe APROBAR una solicitud pendiente o en revisión', async () => {
        //Arrange: Se simula que la solicitud existe y está en estado EN_REVISION, y se espera que se actualice correctamente a APROBADA con el evaluador asignado.
        mockPrisma.solicitud.findUnique.mockResolvedValue({
            id: idSolicitud,
            estado: 'EN_REVISION',
            observacion: null
        });

        //Se simula la actualización de la solicitud a APROBADA con el evaluador asignado
        mockPrisma.solicitud.update.mockResolvedValue({
            id: idSolicitud,
            estado: 'APROBADA',
            responsable_id: idEvaluador,
        });

        //Act: Se ejecuta el caso de uso con el ID de la solicitud, el DTO de evaluación y el ID del evaluador
        const dto: EvaluarSolicitudDto = { estado: 'APROBADA', observacion: 'Aprobado conforme al plan vacacional' };
        const resultado = await useCase.execute(idSolicitud, dto, idEvaluador);

        //Assert: Se verifica que el resultado tenga el estado actualizado a APROBADA y que se haya llamado a Prisma con los datos correctos
        expect(resultado.estado).toBe('APROBADA');
        expect(mockPrisma.solicitud.update).toHaveBeenCalledWith({
            where: { id: idSolicitud },
            data: {
                estado: 'APROBADA',
                observacion: 'Aprobado conforme al plan vacacional',
                responsable_id: idEvaluador
            },
            include: expect.any(Object)
        });
    });

    it('Debe exigir observación descriptiva (mínimo 5 caracteres) al RECHAZAR', async () => {
        //Arrange: Se simula que la solicitud existe y está en estado PENDIENTE, y se espera que se lance una BadRequestException al intentar rechazarla sin una observación válida.
        mockPrisma.solicitud.findUnique.mockResolvedValue({ id: idSolicitud, estado: 'PENDIENTE' });

        //Act: Se ejecuta el caso de uso con un DTO de evaluación sin una observación válida.
        const dtoSinMotivo: EvaluarSolicitudDto = { estado: 'RECHAZADA', observacion: 'No' };

        //Assert: Se espera que se lance una BadRequestException y que no se haya llamado a Prisma para actualizar la solicitud
        await expect(useCase.execute(idSolicitud, dtoSinMotivo, idEvaluador)).rejects.toThrow(BadRequestException);
        expect(mockPrisma.solicitud.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar BadRequestException si la solicitud ya fue dictaminada con anterioridad', async () => {
        //Arrange: Se simula que la solicitud existe pero ya está en estado APROBADA, y se espera que se lance una BadRequestException al intentar evaluarla nuevamente.
        mockPrisma.solicitud.findUnique.mockResolvedValue({ id: idSolicitud, estado: 'APROBADA' });

        //Act: Se ejecuta el caso de uso con un DTO de evaluación para rechazar la solicitud.
        const dto: EvaluarSolicitudDto = { estado: 'RECHAZADA', observacion: 'Cancelación tardía' };

        //Assert: Se espera que se lance una BadRequestException y que no se haya llamado a Prisma para actualizar la solicitud
        await expect(useCase.execute(idSolicitud, dto, idEvaluador)).rejects.toThrow(BadRequestException);
    });
});