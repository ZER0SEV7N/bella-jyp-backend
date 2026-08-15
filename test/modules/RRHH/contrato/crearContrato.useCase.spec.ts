//test/modules/RRHH/contrato/crearContrato.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CrearContratoUseCase } from '@/modules/RRHH/contrato/use-cases/crearContrato.useCase';
import { CrearContratoDto } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';

/**
 * Pruebas unitarias para el caso de uso CrearContratoUseCase
 * Contiene pruebas exhaustivas para verificar el comportamiento del caso de uso de creación de contratos en el módulo de RRHH.
 * Se encarga de probar la lógica de negocio para crear un contrato en la base de datos utilizando Prisma.
 * Incluye pruebas para verificar la existencia del empleado, la validez del estado del contrato, la correcta creación y el manejo de errores.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */
describe('CrearContratoUseCase - Pruebas Unitarias Exhaustivas', () => {
    let useCase: CrearContratoUseCase;
    let prismaService: PrismaService;

    const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';
    const mockEstadoId = '018f4a3c-7b2a-7123-8901-0123456789ac';

    //DTO de prueba para crear un contrato
    const dtoCrear: CrearContratoDto = {
        empleado_id: mockEmpleadoId,
        id_estado: mockEstadoId,
        tipo_modalidad: 'PLAZO_FIJO',
        fecha_inicio: new Date('2026-09-01'),
        fecha_fin: new Date('2027-02-28'),
        observacion: 'Contrato laboral inicial',
    };

    //Mock del servicio Prisma para simular la interacción con la base de datos
    const mockPrismaService = {
        empleados: {
            findUnique: jest.fn()
        },
        estado_contrato: {
            findUnique: jest.fn()
        },
        contratos: {
            create: jest.fn()
        },
    };

    //Configuración del módulo de pruebas antes de cada prueba
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CrearContratoUseCase,
                { provide: PrismaService, useValue: mockPrismaService }
            ]
        }).compile();

        useCase = module.get<CrearContratoUseCase>(CrearContratoUseCase);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => jest.clearAllMocks());

    describe('execute()', () => {
        it('Debe registrar un contrato correctamente asignando un UUIDv7', async () => {
            //Arrange: Configuración de los mocks para simular la existencia del empleado y el estado del contrato
            mockPrismaService.empleados.findUnique.mockResolvedValue({
                id: mockEmpleadoId,
                activo: true,
                deleted_at: null
            });
            mockPrismaService.estado_contrato.findUnique.mockResolvedValue({
                id: mockEstadoId,
                nombre: 'ACTIVO'
            });

            //Simular la creación del contrato y generar un UUIDv7 para el contrato
            const uuidGenerado = IdentityGenerator.generateId();
            mockPrismaService.contratos.create.mockImplementation(({ data }) => Promise.resolve({ ...data, id: uuidGenerado }));

            //Act: Ejecutar el caso de uso para crear un contrato
            const result = await useCase.execute(dtoCrear, 'https://s3.jyp.com/temp.pdf');

            //Assert: Verificar que los métodos de Prisma se llamaron con los parámetros correctos y que el resultado contiene un ID
            expect(prismaService.empleados.findUnique).toHaveBeenCalledWith({ where: { id: mockEmpleadoId } });
            expect(prismaService.estado_contrato.findUnique).toHaveBeenCalledWith({ where: { id: mockEstadoId } });
            expect(prismaService.contratos.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        empleado_id: mockEmpleadoId,
                        id_estado: mockEstadoId,
                        url: 'https://s3.jyp.com/temp.pdf'
                    })
                })
            );
            expect(result).toHaveProperty('id');
        });

        it('Excepción: Debe lanzar NotFoundException si el empleado especificado no existe en la BD', async () => {
            //Arrange: Configuración del mock para simular que el empleado no existe
            mockPrismaService.empleados.findUnique.mockResolvedValue(null);

            //Act: Ejecutar el caso de uso para crear un contrato
            await expect(useCase.execute(dtoCrear)).rejects.toThrow(NotFoundException);
            await expect(useCase.execute(dtoCrear)).rejects.toMatchObject({ 
                response: expect.objectContaining({ message: 'No se encontró un empleado activo con el ID proporcionado' })
            });
        });

        it('Excepción: Debe lanzar NotFoundException si el estado_contrato no existe en el catálogo', async () => {
            //Arrange: Configuración del mock para simular que el empleado existe pero el estado del contrato no
            mockPrismaService.empleados.findUnique.mockResolvedValue({
                id: mockEmpleadoId,
                activo: true,
                deleted_at: null
            });
            mockPrismaService.estado_contrato.findUnique.mockResolvedValue(null);

            //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
            await expect(useCase.execute(dtoCrear)).rejects.toThrow(new NotFoundException('El estado de contrato especificado no existe en el catálogo.'));
        });

        it('Resiliencia: Debe transformar cualquier error imprevisto a InternalServerErrorException', async () => {
           //Arrange: Configuración del mock para simular un error inesperado en la base de datos
            mockPrismaService.empleados.findUnique.mockRejectedValue(new Error('Fatal DB failure'));

            //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
            await expect(useCase.execute(dtoCrear)).rejects.toThrow(InternalServerErrorException);
        });
    });
});