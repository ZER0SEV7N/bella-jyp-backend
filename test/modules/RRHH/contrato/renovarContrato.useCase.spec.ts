//test/modules/RRHH/contrato/renovarContrato.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { RenovarContratoUseCase } from '@/modules/RRHH/contrato/use-cases/renovarContrato.useCase';
import { RenovarContratoDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

/**
 * Pruebas unitarias para el caso de uso RenovarContratoUseCase
 * Contiene pruebas exhaustivas para verificar el comportamiento del caso de uso de renovación de contratos en el módulo de RRHH.
 * Se encarga de probar la lógica de negocio para renovar un contrato en la base de datos utilizando Prisma.
 * Incluye pruebas para verificar la existencia del contrato, la validez de la renovación según las reglas de negocio, la correcta creación del nuevo contrato y el manejo de errores.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */
describe('RenovarContratoUseCase - Pruebas Unitarias Exhaustivas', () => {
    let useCase: RenovarContratoUseCase;
    let prismaService: PrismaService;

    //Mocks de prueba para los IDs de contrato, empleado y estado
    const mockContratoId = '018f4a3c-7b2a-7123-8901-0123456789ad';
    const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';
    const mockEstadoId = '018f4a3c-7b2a-7123-8901-0123456789ac';

    //DTO de prueba para renovar un contrato
    const dtoRenovar: RenovarContratoDto = {
        id_estado: mockEstadoId,
        fecha_inicio: new Date('2026-07-01'),
        fecha_fin: new Date('2026-12-31'),
        tipo_modalidad: 'NECESIDAD_MERCADO',
        observacion: 'Renovación por desempeño'
    };

    //Mock del servicio Prisma para simular la interacción con la base de datos
    const mockPrismaService = {
        contratos: {
            findUnique: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
        },
        $transaction: jest.fn((array) => Promise.all(array)),
    };

    //Configuración del módulo de pruebas antes de cada test
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RenovarContratoUseCase,
                { provide: PrismaService, useValue: mockPrismaService }
            ]
        }).compile();

        useCase = module.get<RenovarContratoUseCase>(RenovarContratoUseCase);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => jest.clearAllMocks());

    describe('execute()', () => {
        it('Debe renovar un contrato en transacción marcar renovado=true y retornar el nuevo contrato', async () => {
            //Arrange: Simulación de un contrato existente con un empleado activo
            const mockContratoAnterior = {
                id: mockContratoId,
                empleado_id: mockEmpleadoId,
                tipo_modalidad: 'PLAZO_FIJO',
                deleted_at: null,
                empleados: { activo: true }
            };

            const nuevoContratoUuid = IdentityGenerator.generateId();

            //Mock de la respuesta de la base de datos para el contrato anterior y la creación del nuevo contrato
            mockPrismaService.contratos.findUnique.mockResolvedValue(mockContratoAnterior);
            mockPrismaService.contratos.update.mockReturnValue({
                id: mockContratoId,
                renovado: true
            });
            mockPrismaService.contratos.create.mockReturnValue({
                id: nuevoContratoUuid,
                empleado_id: mockEmpleadoId,
                renovado: false
            });

            //Act: Ejecución del caso de uso
            const result = await useCase.execute(mockContratoId, dtoRenovar);

            //Assert: Verificación de que los métodos del servicio Prisma fueron llamados con los parámetros correctos
            expect(prismaService.$transaction).toHaveBeenCalled();
            expect(result.id).toBe(nuevoContratoUuid);
        });

        it('Regla de Negocio: Debe rechazar la renovación con BadRequestException si el empleado asociado está cesado (activo === false)', async () => {
            //Arrange: Simulación de un contrato existente con un empleado cesado
            mockPrismaService.contratos.findUnique.mockResolvedValue({
                id: mockContratoId,
                deleted_at: null,
                empleados: { activo: false } //Empleado cesado, no se puede renovar el contrato
            });

            //Act & Assert: Verificación de que se lanza la excepción BadRequestException al intentar renovar el contrato
            await expect(useCase.execute(mockContratoId, dtoRenovar)).rejects.toThrow(new BadRequestException('No se puede crear un contrato de renovación para un empleado cesado.'));
        });

        it('Excepción: Debe lanzar NotFoundException si el contrato a renovar no existe o está eliminado', async () => {
           //Arrange: Simulación de que el contrato a renovar no existe en la base de datos
            mockPrismaService.contratos.findUnique.mockResolvedValue(null);

            //Act & Assert: Verificación de que se lanza la excepción NotFoundException al intentar renovar un contrato inexistente
            await expect(useCase.execute(mockContratoId, dtoRenovar)).rejects.toThrow(new NotFoundException('El contrato a renovar no fue encontrado.'));
        });

        it('Resiliencia: Debe abortar la transacción y retornar InternalServerErrorException en caso de fallo transaccional', async () => {
            //Arrange: Simulación de un contrato existente con un empleado activo
            mockPrismaService.contratos.findUnique.mockResolvedValue({
                id: mockContratoId,
                deleted_at: null,
                empleados: { activo: true }
            });
            //Simulación de un fallo en la transacción al intentar crear el nuevo contrato
            mockPrismaService.$transaction.mockRejectedValue(new Error('Transaction Aborted'));
            //Act & Assert: Verificación de que se lanza la excepción InternalServerErrorException al ocurrir un fallo en la transacción
            await expect(useCase.execute(mockContratoId, dtoRenovar)).rejects.toThrow(new InternalServerErrorException('Error al procesar la renovación del contrato.', 'Transaction Aborted'));
        });
    });
});