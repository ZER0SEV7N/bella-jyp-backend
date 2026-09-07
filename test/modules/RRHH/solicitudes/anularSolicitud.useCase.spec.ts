//test/modules/RRHH/solicitudes/anularSolicitud.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnularSolicitudUseCase } from '@/modules/RRHH/solicitudes/use-cases/anularSolicitud.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso AnularSolicitudUseCase.
 * Estas pruebas verifican la correcta anulación de solicitudes, incluyendo la validación de estados y el manejo de excepciones.
 * Se utilizan mocks para simular la interacción con la base de datos a través de PrismaService.
 */
describe('AnularSolicitudUseCase - Pruebas Unitarias', () => {
    let useCase: AnularSolicitudUseCase;
    let prisma: PrismaService;

    //Mocks de PrismaService para simular la base de datos
    const mockPrisma = { solicitud: { findUnique: jest.fn(), update: jest.fn() } };

    //Datos de prueba para una solicitud ficticia
    const idSolicitud = 'sol-uuid-1';

    //Configuración inicial de las pruebas, creando un módulo de prueba y obteniendo instancias de los casos de uso y servicios
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AnularSolicitudUseCase,
                { provide: PrismaService, useValue: mockPrisma },
            ]
        }).compile();

        useCase = module.get<AnularSolicitudUseCase>(AnularSolicitudUseCase);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => jest.clearAllMocks());

    it('Happy Path: Debe anular una solicitud aplicando soft delete y registrando el motivo', async () => {
        //Arrange: Se simula que la solicitud existe y está en estado PENDIENTE, y se espera que se actualice correctamente a ANULADA con el motivo de anulación.
        mockPrisma.solicitud.findUnique.mockResolvedValue({
            id: idSolicitud,
            estado: 'PENDIENTE',
            observacion: null
        });

        mockPrisma.solicitud.update.mockResolvedValue({
            id: idSolicitud,
            estado: 'ANULADA',
            deleted_at: new Date()
        });

        //Act: Se ejecuta el caso de uso con el ID de la solicitud y un motivo de anulación
        const resultado = await useCase.execute(idSolicitud, 'Colaborador desiste de la solicitud');

        //Assert: Se verifica que el resultado tenga el estado actualizado a ANULADA y que se haya llamado a Prisma con los datos correctos
        expect(resultado.estado).toBe('ANULADA');
        expect(mockPrisma.solicitud.update).toHaveBeenCalledWith({
            where: { id: idSolicitud },
            data: {
                estado: 'ANULADA',
                observacion: '[ANULADA]: Colaborador desiste de la solicitud',
                deleted_at: expect.any(Date)
            }
        });
    });

    it('Debe bloquear con BadRequestException si la solicitud ya se encuentra formalmente aprobada', async () => {
        //Arrange: Se simula que la solicitud existe pero ya está en estado APROBADA, y se espera que se lance una BadRequestException al intentar anularla.
        mockPrisma.solicitud.findUnique.mockResolvedValue({
            id: idSolicitud,
            estado: 'APROBADA'
        });

        //Act & Assert: Se espera que se lance una BadRequestException y que no se haya llamado a Prisma para actualizar la solicitud
        await expect(useCase.execute(idSolicitud, 'Motivo cualquiera')).rejects.toThrow(BadRequestException);
        expect(mockPrisma.solicitud.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si la solicitud no existe o ya fue eliminada', async () => {
        //Arrange: Se simula que la solicitud no existe, y se espera que se lance una NotFoundException al intentar anularla.
        mockPrisma.solicitud.findUnique.mockResolvedValue(null);

        //Act & Assert: Se espera que se lance una NotFoundException y que no se haya llamado a Prisma para actualizar la solicitud
        await expect(useCase.execute('sol-404', 'Motivo')).rejects.toThrow(NotFoundException);
    });
});