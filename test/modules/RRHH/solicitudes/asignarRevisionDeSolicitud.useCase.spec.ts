//test/modules/RRHH/solicitudes/asignarRevisionDeSolicitud.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AsignarRevisionDeSolicitudUseCase } from '@/modules/RRHH/solicitudes/use-cases/asignarRevisionDeSolicitud.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Pruebas unitarias para el caso de uso AsignarRevisionDeSolicitudUseCase.
 * Estas pruebas verifican la correcta asignación de solicitudes a revisores,
 * la validación de estados de solicitud y el manejo de excepciones.
 * Se utilizan mocks para simular la interacción con la base de datos a través de PrismaService.
 */
describe('AsignarRevisionDeSolicitudUseCase - Pruebas Unitarias', () => {
    let useCase: AsignarRevisionDeSolicitudUseCase;
    let prisma: PrismaService;

    //Mocks de PrismaService para simular la base de datos
    const mockPrisma = { solicitud: { findUnique: jest.fn(), update: jest.fn() } };

    //Datos de prueba para una solicitud ficticia y un revisor
    const idSolicitud = 'sol-uuid-1';
    const idUsuarioRevisor = 'user-uuid-rrhh';

    //Configuración inicial de las pruebas, creando un módulo de prueba y obteniendo instancias de los casos de uso y servicios
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AsignarRevisionDeSolicitudUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<AsignarRevisionDeSolicitudUseCase>(AsignarRevisionDeSolicitudUseCase);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => jest.clearAllMocks());

    it('Happy Path: Debe asignar la solicitud y actualizar estado a EN_REVISION', async () => {
        //Arrange: Se simula que la solicitud existe y está en estado PENDIENTE, y se espera que se actualice correctamente a EN_REVISION con el revisor asignado.
        mockPrisma.solicitud.findUnique.mockResolvedValue({
            id: idSolicitud,
            estado: 'PENDIENTE',
            responsable_id: null
        });

        //Se simula la actualización de la solicitud a EN_REVISION con el revisor asignado
        mockPrisma.solicitud.update.mockResolvedValue({
            id: idSolicitud,
            responsable_id: idUsuarioRevisor,
            estado: 'EN_REVISION'
        });

        //Act: Se ejecuta el caso de uso con el ID de la solicitud y el ID del revisor
        const resultado = await useCase.execute(idSolicitud, idUsuarioRevisor);

        //Assert: Se verifica que el resultado tenga el estado actualizado a EN_REVISION y que se haya llamado a Prisma con los datos correctos
        expect(resultado.estado).toBe('EN_REVISION');
        expect(mockPrisma.solicitud.update).toHaveBeenCalledWith({
            where: { id: idSolicitud },
            data: { responsable_id: idUsuarioRevisor, estado: 'EN_REVISION' },
            include: expect.any(Object)
        });
    });

    it('Debe lanzar BadRequestException si la solicitud ya fue APROBADA o RECHAZADA', async () => {
        //Arrange: Se simula que la solicitud existe pero ya está en estado APROBADA, y se espera que se lance una BadRequestException al intentar asignarla a revisión.
        mockPrisma.solicitud.findUnique.mockResolvedValue({
            id: idSolicitud,
            estado: 'APROBADA'
        });

        //Act & Assert: Se espera que se lance una BadRequestException y que no se haya llamado a Prisma para actualizar la solicitud
        await expect(useCase.execute(idSolicitud, idUsuarioRevisor)).rejects.toThrow(BadRequestException);
        expect(mockPrisma.solicitud.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar BadRequestException si la solicitud ya está tomada por otro revisor', async () => {
        //Arrange: Se simula que la solicitud existe y está en estado EN_REVISION pero ya tiene un revisor asignado, y se espera que se lance una BadRequestException al intentar asignarla a otro revisor.
        mockPrisma.solicitud.findUnique.mockResolvedValue({
            id: idSolicitud,
            estado: 'EN_REVISION',
            responsable_id: 'otro-usuario-uuid',
            responsable: { empleados: { nombre: 'María', apellido: 'Gómez' } }
        });

        //Act & Assert: Se espera que se lance una BadRequestException y que no se haya llamado a Prisma para actualizar la solicitud
        await expect(useCase.execute(idSolicitud, idUsuarioRevisor)).rejects.toThrow(BadRequestException);
        expect(mockPrisma.solicitud.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si la solicitud no existe', async () => {
        //Arrange: Se simula que la solicitud no existe en la base de datos, y se espera que se lance una NotFoundException al intentar asignarla a revisión.
        mockPrisma.solicitud.findUnique.mockResolvedValue(null);

        //Act & Assert: Se espera que se lance una NotFoundException y que no se haya llamado a Prisma para actualizar la solicitud
        await expect(useCase.execute('id-inexistente', idUsuarioRevisor)).rejects.toThrow(NotFoundException);
    });
});