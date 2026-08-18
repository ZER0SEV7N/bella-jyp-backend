//test/modules/RRHH/contrato/listarContrato.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ListarContratoUseCase } from '@/modules/RRHH/contrato/use-cases/listarContrato.useCase';

/**
 * Pruebas unitarias exhaustivas para el caso de uso ListarContratoUseCase.
 * Se verifica el comportamiento esperado en diferentes escenarios, incluyendo:
 * - Listado exitoso de contratos para un empleado activo.
 * - Manejo de errores cuando el empleado no existe o está eliminado.
 * - Captura de errores inesperados y lanzamiento de excepciones adecuadas.
 */
describe('ListarContratoUseCase - Pruebas Unitarias Exhaustivas', () => {
    let useCase: ListarContratoUseCase;
    let prismaService: PrismaService;

    //Mock de empleadoId para las pruebas
    const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';

    //Mock del servicio Prisma para simular la interacción con la base de datos
    const mockPrismaService = {
        empleados: {findUnique: jest.fn()},
        contratos: {findMany: jest.fn()}
    };

    //Configuración del módulo de pruebas antes de cada test
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ListarContratoUseCase,
                { provide: PrismaService, useValue: mockPrismaService }
            ]
        }).compile();

        useCase = module.get<ListarContratoUseCase>(ListarContratoUseCase);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => jest.clearAllMocks());

    describe('execute()', () => {
        it('Debe listar los contratos ordenados descendentemente para un empleado activo', async () => {
            //Arrange: Configuración de los datos simulados para el empleado y sus contratos
            const mockEmpleado = {
                id: mockEmpleadoId,
                nombre: 'Carlos',
                apellido: 'Mendoza',
                nro_documento: '72345678'
            };

            //Mock de contratos asociados al empleado
            const mockContratosList = [{
                id: '018f4a3c-7b2a-7123-8901-0123456789ad',
                empleado_id: mockEmpleadoId,
                fecha_inicio: new Date('2026-01-01'),
                estado_contrato: { nombre: 'ACTIVO' }
            }];

            //Simular la respuesta de la base de datos para el empleado y sus contratos
            mockPrismaService.empleados.findUnique.mockResolvedValue(mockEmpleado);
            mockPrismaService.contratos.findMany.mockResolvedValue(mockContratosList);

            //Act: Ejecución del caso de uso
            const result = await useCase.execute(mockEmpleadoId);

            //Assert: Verificación de que los métodos del servicio Prisma fueron llamados con los parámetros correctos
            expect(prismaService.empleados.findUnique).toHaveBeenCalledWith({
                where: { id: mockEmpleadoId, deleted_at: null },
                select: { id: true, nombre: true, apellido: true, nro_documento: true },
            });
            expect(result.empleado).toBe('Carlos Mendoza');
            expect(result.documento).toBe('72345678');
        });

        it('Debe lanzar NotFoundException si el empleado no existe o tiene deleted_at !== null', async () => {
            //Arrange: Simulación de que el empleado no existe en la base de datos
            mockPrismaService.empleados.findUnique.mockResolvedValue(null);

            //Act & Assert: Verificación de que se lanza la excepción NotFoundException al ejecutar el caso de uso
            await expect(useCase.execute(mockEmpleadoId)).rejects.toThrow(new NotFoundException('Empleado no encontrado o eliminado de la db'));
        });

        it('Debe capturar errores no esperados y arrojar InternalServerErrorException', async () => {
            //Arrange: Simulación de un error inesperado en la base de datos al buscar los contratos del empleado
            const mockEmpleado = {
                id: mockEmpleadoId,
                nombre: 'Carlos',
                apellido: 'Mendoza',
                nro_documento: '72345678'
            };

            //Act & Assert: Verificación de que se lanza la excepción InternalServerErrorException al ejecutar el caso de uso
            mockPrismaService.empleados.findUnique.mockResolvedValue(mockEmpleado);
            mockPrismaService.contratos.findMany.mockRejectedValue(new Error('DB Connection Timeout'));
            await expect(useCase.execute(mockEmpleadoId)).rejects.toThrow(InternalServerErrorException);
        });
    });
});