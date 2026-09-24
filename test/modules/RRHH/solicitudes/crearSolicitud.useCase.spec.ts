//test/modules/RRHH/solicitudes/crearSolicitud.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CrearSolicitudUseCase } from '@/modules/RRHH/solicitudes/use-cases/crearSolicitud.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearSolicitudDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias para el caso de uso CrearSolicitudUseCase.
 * Estas pruebas verifican la correcta generación de códigos correlativos,
 * la validación de fechas, la existencia del empleado solicitante y el manejo de archivos adjuntos.
 * Se utilizan mocks para simular la interacción con la base de datos a través de PrismaService.
 */
describe('CrearSolicitudUseCase - Pruebas Unitarias Exhaustivas', () => {
    let useCase: CrearSolicitudUseCase;
    let prisma: PrismaService;

    //Mocks de PrismaService para simular la base de datos
    const mockPrisma = {
        empleados: { findUnique: jest.fn() },
        solicitud: { findFirst: jest.fn(), create: jest.fn() }
    };

    //Datos de prueba para un empleado ficticio y un DTO válido de solicitud
    const empleadoMock = {
        id: 'emp-uuid-100',
        nombre: 'Juan',
        apellido: 'Pérez',
        nro_documento: '70809010',
        activo: true,
        deleted_at: null
    };

    //DTO de prueba para crear una solicitud válida
    const dtoValido: CrearSolicitudDto = {
        empleado_id: 'emp-uuid-100',
        tipo: 'VACACIONES',
        fecha_inicio: '2026-10-05',
        fecha_fin: '2026-10-19',
        dias_solicitados: 15,
        motivo: 'Vacaciones anuales coordinadas con jefatura',
        origen: 'PORTAL_EMPLEADO'
    };

    //Configuración inicial de las pruebas, creando un módulo de prueba y obteniendo instancias de los casos de uso y servicios
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CrearSolicitudUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<CrearSolicitudUseCase>(CrearSolicitudUseCase);
        prisma = module.get<PrismaService>(PrismaService);

        jest.spyOn(IdentityGenerator, 'generateId').mockReturnValue('solicitud-uuid-001');
    });

    afterEach(() => jest.clearAllMocks());

    describe('Generación de Correlativo y Registro Exitoso (Happy Path)', () => {
        it('Debe generar el primer correlativo del año (SOL-YYYY-001) si no existen previas', async () => {
            //Arrange: Se simula que no existen solicitudes previas para el año actual, y se espera que se genere el primer correlativo correctamente.
            const year = new Date().getFullYear(); //Año actual para el correlativo
            mockPrisma.empleados.findUnique.mockResolvedValue(empleadoMock); //Simular que el empleado existe y está activo
            mockPrisma.solicitud.findFirst.mockResolvedValue(null); // No hay previas

            //La respuesta esperada de la creación de la solicitud, incluyendo el código correlativo generado automáticamente
            const solicitudCreadaEsperada = {
                id: 'solicitud-uuid-001',
                codigo: `SOL-${year}-001`,
                estado: 'PENDIENTE',
                ...dtoValido
            };

            //Se simula la creación de la solicitud en la base de datos, devolviendo el objeto esperado
            mockPrisma.solicitud.create.mockResolvedValue(solicitudCreadaEsperada);

            //Act: Se ejecuta el caso de uso con el DTO válido y el ID del empleado
            const resultado = await useCase.execute(dtoValido, 'emp-uuid-100');

            //Assert: Se verifica que el resultado contenga el código correlativo esperado y que se haya llamado a Prisma con los datos correctos
            expect(resultado.codigo).toBe(`SOL-${year}-001`);
            expect(mockPrisma.solicitud.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    codigo: `SOL-${year}-001`,
                    estado: 'PENDIENTE',
                    dias_solicitados: 15
                })
            }));
        });

        it('Debe autoincrementar correlativo correlativo (SOL-YYYY-005 -> SOL-YYYY-006)', async () => {
            //Arrange: Se simula que ya existen solicitudes previas para el año actual, y se espera que se genere el siguiente correlativo correctamente.
            const year = new Date().getFullYear();
            mockPrisma.empleados.findUnique.mockResolvedValue(empleadoMock);
            mockPrisma.solicitud.findFirst.mockResolvedValue({ codigo: `SOL-${year}-005` }); //Simular que la última solicitud tiene el correlativo 005
            mockPrisma.solicitud.create.mockResolvedValue({ id: 'solicitud-uuid-001', codigo: `SOL-${year}-006` }); //Simular la creación de la nueva solicitud con correlativo 006

            //Act: Se ejecuta el caso de uso con el DTO válido y el ID del empleado
            const resultado = await useCase.execute(dtoValido, 'emp-uuid-100');

            //Assert: Se verifica que el resultado contenga el código correlativo esperado y que se haya llamado a Prisma con los datos correctos
            expect(resultado.codigo).toBe(`SOL-${year}-006`);
        });

        it('Debe calcular fecha_limite como 1 día antes del inicio y adjuntar sustento si existe', async () => {
            //Arrange: Se simula que el empleado existe y que no hay solicitudes previas, y se espera que la fecha límite se calcule correctamente y que se adjunte el archivo de sustento.
            mockPrisma.empleados.findUnique.mockResolvedValue(empleadoMock);
            mockPrisma.solicitud.findFirst.mockResolvedValue(null);
            mockPrisma.solicitud.create.mockResolvedValue({ id: 'solicitud-uuid-001' });

            //Act: Se ejecuta el caso de uso con el DTO válido, el ID del empleado y un archivo de sustento
            const archivo = { url: '/archivos/sustentos/descanso.pdf', nombreOriginal: 'descanso.pdf' };
            await useCase.execute(dtoValido, 'emp-uuid-100', archivo);

            //Assert: Se verifica que la fecha límite se haya calculado correctamente y que se haya llamado a Prisma con los datos correctos, incluyendo el archivo de sustento
            expect(mockPrisma.solicitud.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    sustento_url: '/archivos/sustentos/descanso.pdf',
                    sustento_nombre: 'descanso.pdf',
                    fecha_limite: new Date(new Date('2026-10-05').getTime() - 24 * 60 * 60 * 1000)
                })
            }));
        });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
        it('Debe lanzar BadRequestException si la fecha de inicio es posterior a la fecha fin', async () => {
            //Arrange: Se simula que el empleado existe y que no hay solicitudes previas, y se espera que se lance una excepción si las fechas son inválidas.
            mockPrisma.empleados.findUnique.mockResolvedValue(empleadoMock);

            //DTO con fechas inválidas (fecha_inicio posterior a fecha_fin)
            const dtoFechasInvalidas: CrearSolicitudDto = {
                ...dtoValido,
                fecha_inicio: '2026-10-20',
                fecha_fin: '2026-10-05'
            };

            //Act & Assert: Se espera que se lance una BadRequestException y que no se haya llamado a Prisma para crear la solicitud
            await expect(useCase.execute(dtoFechasInvalidas, 'emp-uuid-100')).rejects.toThrow(BadRequestException);
            expect(mockPrisma.solicitud.create).not.toHaveBeenCalled();
        });

        it('Debe lanzar NotFoundException si el empleado solicitante no existe o está inactivo', async () => {
            //Arrange: Se simula que el empleado no existe o está inactivo, y se espera que se lance una NotFoundException al intentar crear la solicitud.
            mockPrisma.empleados.findUnique.mockResolvedValue({ ...empleadoMock, activo: false });

            //Act & Assert: Se espera que se lance una NotFoundException y que no se haya llamado a Prisma para crear la solicitud
            await expect(useCase.execute(dtoValido, 'emp-uuid-100')).rejects.toThrow(NotFoundException);
            expect(mockPrisma.solicitud.create).not.toHaveBeenCalled();
        });
    });
});