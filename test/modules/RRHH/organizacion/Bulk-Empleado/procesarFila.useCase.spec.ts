//test/modules/RRHH/organizacion/Bulk-Empleado/procesarFila.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProcesarFilaEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '@/modules/RRHH/organizacion/services/reniec.adapter';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el caso de uso ProcesarFilaEmpleadoUseCase.
 * Se verifican los diferentes escenarios, incluyendo la inserción/actualización exitosa de empleados,
 * la consulta a la API de RENIEC cuando faltan datos, la creación automática de áreas y cargos,
 * y el manejo de errores y validaciones.
 * Se utilizan mocks para simular la interacción con PrismaService y ReniecAdapter.
 */
describe('ProcesarFilaEmpleadoUseCase - Pruebas Unitarias Exhaustivas', () => {
    let useCase: ProcesarFilaEmpleadoUseCase;
    let prismaService: PrismaService;
    let reniecAdapter: ReniecAdapter;

    //Mocks de PrismaService y ReniecAdapter para simular la interacción con la base de datos y el servicio externo
    const mockPrismaService = {
        tipo_documento: { findFirst: jest.fn() },
        area: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
        cargo: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
        jornada: { findFirst: jest.fn(), findMany: jest.fn() },
        estado_empleado: { findFirst: jest.fn() },
        empleados: { upsert: jest.fn() }
    };

    const mockReniecAdapter = {consultarDni: jest.fn()};

    //Configuración inicial antes de cada prueba
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProcesarFilaEmpleadoUseCase,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: ReniecAdapter, useValue: mockReniecAdapter }
            ]
        }).compile();

        useCase = module.get<ProcesarFilaEmpleadoUseCase>(ProcesarFilaEmpleadoUseCase);
        prismaService = module.get<PrismaService>(PrismaService);
        reniecAdapter = module.get<ReniecAdapter>(ReniecAdapter);
    });

    afterEach(() => jest.clearAllMocks());

    describe('execute() - Happy Paths', () => {
        it('Debe procesar e insertar/actualizar (upsert) exitosamente un empleado con datos completos', async () => {
            //Arrange: Simular una fila de carga masiva con todos los datos requeridos
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '72345678',
                nombre: 'Carlos',
                apellido: 'Mendoza',
                area: 'Sistemas',
                cargo: 'Desarrollador',
                jornada: 'Turno Mañana',
                fecha_nacimiento: '1995-05-15',
                asig_familiar: true
            };

            //Simular que los catálogos existen en la base de datos
            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-uuid-1', tipo_documento: 'DNI' });
            mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-uuid-1', nombre: 'Sistemas' });
            mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'cargo-uuid-1', nombre: 'Desarrollador' });
            mockPrismaService.jornada.findFirst.mockResolvedValue({ id: 'jornada-uuid-1', nombre: 'Turno Mañana' });
            mockPrismaService.estado_empleado.findFirst.mockResolvedValue({ id: 'estado-uuid-1', descripcion: 'ACTIVO' });
            mockPrismaService.empleados.upsert.mockResolvedValue({ id: 'emp-uuid-1', nro_documento: '72345678' });

            //Act: Ejecutar el caso de uso con la fila simulada y un jobId
            await useCase.execute(mockFila, 'job-uuid-1');

            expect(prismaService.tipo_documento.findFirst).toHaveBeenCalledWith({where: { tipo_documento: { equals: 'DNI', mode: 'insensitive' } }});
            expect(prismaService.empleados.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { nro_documento: '72345678' },
                update: expect.objectContaining({
                    nombre: 'Carlos',
                    apellido: 'Mendoza',
                    area_id: 'area-uuid-1',
                    cargo_id: 'cargo-uuid-1',
                    jornada_id: 'jornada-uuid-1',
                    asig_familiar: true,
                    estado_sincronizacion: 'COMPLETO'
                })
            }));
            expect(reniecAdapter.consultarDni).not.toHaveBeenCalled();
        });

        it('Debe consultar la API de RENIEC cuando los nombres no vienen en la fila del CSV', async () => {
            //Arrange: Simular una fila de carga masiva sin nombres y apellidos
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '70654321',
                area: 'Recursos Humanos',
                cargo: 'Analista',
                asig_familiar: false
            };

            //Simular que los catálogos existen en la base de datos
            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-uuid-1' });
            mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-uuid-2', nombre: 'Recursos Humanos' });
            mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'cargo-uuid-2', nombre: 'Analista' });
            mockPrismaService.estado_empleado.findFirst.mockResolvedValue({ id: 'estado-uuid-1' });

            //Simular que la API de RENIEC devuelve nombres y apellidos válidos para el DNI proporcionado
            mockReniecAdapter.consultarDni.mockResolvedValue({
                nombre: 'María',
                apellido_paterno: 'Gómez',
                apellido_materno: 'Ríos'
            });

            //Act: Ejecutar el caso de uso con la fila simulada y un jobId
            await useCase.execute(mockFila, 'job-uuid-2');

            //Assert: Verificar que se haya llamado a la API de RENIEC y que los datos del empleado se hayan completado correctamente
            expect(reniecAdapter.consultarDni).toHaveBeenCalledWith('70654321');
            expect(prismaService.empleados.upsert).toHaveBeenCalledWith(expect.objectContaining({
                create: expect.objectContaining({
                    nombre: 'María',
                    apellido: 'Gómez Ríos',
                    estado_sincronizacion: 'COMPLETO'
                })
            }));
        });

        it('Debe auto-crear el Área y el Cargo si no existen previamente en la base de datos', async () => {
            //Arrange: Simular una fila de carga masiva con un área y cargo que no existen en la base de datos
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '78990011',
                nombre: 'Ana',
                apellido: 'Lopez',
                area: 'Nueva Area Logistica',
                cargo: 'Jefe de Almacen',
                asig_familiar: false
            };

            //Simular que los catálogos no existen en la base de datos
            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-uuid-1' });
            mockPrismaService.area.findFirst.mockResolvedValue(null);
            mockPrismaService.area.findMany.mockResolvedValue([]);
            mockPrismaService.area.create.mockResolvedValue({ id: 'new-area-id', nombre: 'Nueva Area Logistica' });

            mockPrismaService.cargo.findFirst.mockResolvedValue(null);
            mockPrismaService.cargo.findMany.mockResolvedValue([]);
            mockPrismaService.cargo.create.mockResolvedValue({ id: 'new-cargo-id', nombre: 'Jefe de Almacen' });

            mockPrismaService.estado_empleado.findFirst.mockResolvedValue({ id: 'estado-uuid-1' });

            //Act: Ejecutar el caso de uso con la fila simulada y un jobId
            await useCase.execute(mockFila, 'job-uuid-3');

            //Assert: Verificar que se hayan creado el Área y el Cargo automáticamente y que el empleado se haya insertado correctamente
            expect(prismaService.area.create).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({ nombre: 'Nueva Area Logistica' })}));
            expect(prismaService.cargo.create).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({ nombre: 'Jefe de Almacen', id_area: 'new-area-id' })}));
        });
    });

    describe('execute() - Validaciones y Excepciones', () => {
        it('Debe lanzar un error si el tipo de documento especificado no existe en la base de datos', async () => {
            //Arrange: Simular una fila de carga masiva con un tipo de documento inexistente
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'PTP',
                nro_documento: '99999999',
                area: 'Sistemas',
                cargo: 'DevOps',
                asig_familiar: false
            };

            //Simular que el tipo de documento no existe en la base de datos
            mockPrismaService.tipo_documento.findFirst.mockResolvedValue(null);

            //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
            await expect(useCase.execute(mockFila, 'job-1')).rejects.toThrow("El tipo de documento 'PTP' no existe en la base de datos.");
        });

        it('Debe lanzar un error si el catálogo del estado de empleado ACTIVO no está configurado', async () => {
            //Arrange: Simular una fila de carga masiva con datos válidos pero sin un estado de empleado ACTIVO configurado
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '72345678',
                nombre: 'Carlos',
                apellido: 'Mendoza',
                area: 'Sistemas',
                cargo: 'Analista',
                asig_familiar: false
            };

            //Simular que los catálogos existen excepto el estado de empleado ACTIVO
            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-1' });
            mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-1', nombre: 'Sistemas' });
            mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'cargo-1', nombre: 'Analista' });
            mockPrismaService.estado_empleado.findFirst.mockResolvedValue(null);

            //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
            await expect(useCase.execute(mockFila, 'job-1')).rejects.toThrow('Catálogo de estado ACTIVO no configurado.');
        });

        it('Debe degradar el legajo a BORRADOR si RENIEC falla y los nombres están ausentes', async () => {
            //Arrange: Simular una fila de carga masiva sin nombres y apellidos, y simular un fallo en la API de RENIEC
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '72345678',
                area: 'Sistemas',
                cargo: 'Analista',
                asig_familiar: false
            };

            //Simular que los catálogos existen en la base de datos
            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-1' });
            mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-1', nombre: 'Sistemas' });
            mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'cargo-1', nombre: 'Analista' });
            mockPrismaService.estado_empleado.findFirst.mockResolvedValue({ id: 'estado-1' });

            mockReniecAdapter.consultarDni.mockRejectedValue(new Error('RENIEC Timeout 504'));

            //Act: Ejecutar el caso de uso con la fila simulada y un jobId
            await useCase.execute(mockFila, 'job-1');

            //Assert: Verificar que se haya degradado el legajo a BORRADOR y que se hayan insertado los datos con valores por defecto
            expect(prismaService.empleados.upsert).toHaveBeenCalledWith(expect.objectContaining({
                create: expect.objectContaining({
                    nombre: 'NO_REGISTRADO',
                    apellido: 'NO_REGISTRADO',
                    estado_sincronizacion: 'BORRADOR'
                })
            }));
        });
    });
});