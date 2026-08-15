import { Test, TestingModule } from '@nestjs/testing';
import { ProcesarFilaEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '@/modules/RRHH/organizacion/services/reniec.adapter';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';

describe('ProcesarFilaEmpleadoUseCase - Pruebas Unitarias Exhaustivas', () => {
    let useCase: ProcesarFilaEmpleadoUseCase;
    let prismaService: PrismaService;
    let reniecAdapter: ReniecAdapter;

    const mockPrismaService = {
        tipo_documento: {findFirst: jest.fn()},
        area: {findFirst: jest.fn()},
        cargo: {findFirst: jest.fn()},
        jornada: {findFirst: jest.fn()},
        estado_empleado: {findFirst: jest.fn()},
        empleados: {upsert: jest.fn()}
    };

    const mockReniecAdapter = {
        consultarDni: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
        providers: [
            ProcesarFilaEmpleadoUseCase,
            { provide: PrismaService, useValue: mockPrismaService },
            { provide: ReniecAdapter, useValue: mockReniecAdapter },
        ],
        }).compile();

        useCase = module.get<ProcesarFilaEmpleadoUseCase>(ProcesarFilaEmpleadoUseCase);
        prismaService = module.get<PrismaService>(PrismaService);
        reniecAdapter = module.get<ReniecAdapter>(ReniecAdapter);

        jest.clearAllMocks();
    });

    describe('execute() - Happy Paths', () => {
        it('Debe procesar e insertar/actualizar (upsert) exitosamente un empleado con datos completos', async () => {
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '72345678',
                nombre: 'Carlos',
                apellido: 'Mendoza',
                area: 'Sistemas',
                cargo: 'Desarrollador',
                jornada: 'Turno Mañana',
                fecha_nacimiento: '1995-05-15',
                asig_familiar: true,
            };

            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-uuid-1', tipo_documento: 'DNI' });
            mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-uuid-1', nombre: 'Sistemas' });
            mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'cargo-uuid-1', nombre: 'Desarrollador' });
            mockPrismaService.jornada.findFirst.mockResolvedValue({ id: 'jornada-uuid-1', nombre: 'Turno Mañana' });
            mockPrismaService.estado_empleado.findFirst.mockResolvedValue({ id: 'estado-uuid-1', descripcion: 'ACTIVO' });
            mockPrismaService.empleados.upsert.mockResolvedValue({ id: 'emp-uuid-1', nro_documento: '72345678' });

            await useCase.execute(mockFila, 'job-uuid-1');

            expect(prismaService.tipo_documento.findFirst).toHaveBeenCalledWith({where: { tipo_documento: { equals: 'DNI', mode: 'insensitive' } }});
            expect(prismaService.area.findFirst).toHaveBeenCalledWith({where: { nombre: { equals: 'Sistemas', mode: 'insensitive' }, deleted_at: null }});
            expect(prismaService.cargo.findFirst).toHaveBeenCalledWith({where: { nombre: { equals: 'Desarrollador', mode: 'insensitive' }, id_area: 'area-uuid-1', deleted_at: null }});
            expect(prismaService.jornada.findFirst).toHaveBeenCalledWith({where: { nombre: { equals: 'Turno Mañana', mode: 'insensitive' }, deleted_at: null },});
            expect(prismaService.empleados.upsert).toHaveBeenCalledWith({
                where: { nro_documento: '72345678' },
                update: expect.objectContaining({
                    area_id: 'area-uuid-1',
                    cargo_id: 'cargo-uuid-1',
                    jornada_id: 'jornada-uuid-1',
                    asig_familiar: true,
                    estado_sincronizacion: 'COMPLETO'
                }),
                create: expect.objectContaining({
                    nro_documento: '72345678',
                    nombre: 'Carlos',
                    apellido: 'Mendoza',
                    area_id: 'area-uuid-1',
                    cargo_id: 'cargo-uuid-1',
                    estado_sincronizacion: 'COMPLETO',
                    activo: true
                })
            });
            expect(reniecAdapter.consultarDni).not.toHaveBeenCalled();
        });

        it('Debe consultar la API de RENIEC cuando los nombres no vienen en la fila del CSV', async () => {
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '70654321',
                area: 'Recursos Humanos',
                cargo: 'Analista',
                asig_familiar: false
            };

            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-uuid-1' });
            mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-uuid-2' });
            mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'cargo-uuid-2' });
            mockPrismaService.estado_empleado.findFirst.mockResolvedValue({ id: 'estado-uuid-1' });

            mockReniecAdapter.consultarDni.mockResolvedValue({
                nombre: 'María',
                apellido_paterno: 'Gómez',
                apellido_materno: 'Ríos'
            });

            await useCase.execute(mockFila, 'job-uuid-2');

            expect(reniecAdapter.consultarDni).toHaveBeenCalledWith('70654321');
            expect(prismaService.empleados.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        nombre: 'María',
                        apellido: 'Gómez Ríos',
                        estado_sincronizacion: 'COMPLETO'
                    })
                })
            );
        });
    });

    describe('execute() - Validaciones y Catálogos Inexistentes', () => {
        it('Debe lanzar un error si el tipo de documento especificado no existe en la base de datos', async () => {
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'PTP',
                nro_documento: '99999999',
                area: 'Sistemas',
                cargo: 'DevOps',
                asig_familiar: false
            };

            mockPrismaService.tipo_documento.findFirst.mockResolvedValue(null);

            await expect(useCase.execute(mockFila, 'job-1')).rejects.toThrow("El tipo de documento 'PTP' no existe en la base de datos.");
        });

        it('Debe lanzar un error si el área especificada no existe o se encuentra deshabilitada', async () => {
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '72345678',
                area: 'Inexistente',
                cargo: 'DevOps',
                asig_familiar: false
            };

            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-1' });
            mockPrismaService.area.findFirst.mockResolvedValue(null);

            await expect(useCase.execute(mockFila, 'job-1')).rejects.toThrow("El área 'Inexistente' no existe o está desactivada.");
        });

        it('Debe lanzar un error si el cargo no pertenece al área indicada o no existe', async () => {
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '72345678',
                area: 'Sistemas',
                cargo: 'Gerente Comercial',
                asig_familiar: false
            };

            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-1' });
            mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-1', nombre: 'Sistemas' });
            mockPrismaService.cargo.findFirst.mockResolvedValue(null);

            await expect(useCase.execute(mockFila, 'job-1')).rejects.toThrow("El cargo 'Gerente Comercial' no existe dentro del área 'Sistemas'.");
        });

        it('Debe lanzar un error si la jornada/turno provista no existe en la base de datos', async () => {
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '72345678',
                area: 'Sistemas',
                cargo: 'Analista',
                jornada: 'Turno Nocturno Inexistente',
                asig_familiar: false
            };

            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-1' });
            mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-1' });
            mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'cargo-1' });
            mockPrismaService.jornada.findFirst.mockResolvedValue(null);

            await expect(useCase.execute(mockFila, 'job-1')).rejects.toThrow("El turno/jornada 'Turno Nocturno Inexistente' no existe.");
        });

        it('Debe lanzar un error si el catálogo del estado de empleado ACTIVO no está configurado', async () => {
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '72345678',
                nombre: 'Carlos',
                apellido: 'Mendoza',
                area: 'Sistemas',
                cargo: 'Analista',
                asig_familiar: false
            };

            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-1' });
            mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-1' });
            mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'cargo-1' });
            mockPrismaService.estado_empleado.findFirst.mockResolvedValue(null);

            await expect(useCase.execute(mockFila, 'job-1')).rejects.toThrow('Catálogo de estado ACTIVO no configurado.');
        });

        it('Debe lanzar un error si los nombres no vienen en el CSV y la consulta a RENIEC falla', async () => {
            const mockFila: CargaMasivaFilaDTO = {
                tipo_documento: 'DNI',
                nro_documento: '72345678',
                area: 'Sistemas',
                cargo: 'Analista',
                asig_familiar: false
            };

            mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-1' });
            mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-1' });
            mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'cargo-1' });
            mockPrismaService.estado_empleado.findFirst.mockResolvedValue({ id: 'estado-1' });

            mockReniecAdapter.consultarDni.mockRejectedValue(new Error('RENIEC Timeout 504'));

            await expect(useCase.execute(mockFila, 'job-1')).rejects.toThrow('Imposible registrar DNI 72345678: Nombres ausentes y RENIEC inoperativo.');
        });
    });
});