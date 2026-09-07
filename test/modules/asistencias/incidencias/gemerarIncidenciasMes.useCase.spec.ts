//test/modules/asistencias/incidencias/gemerarIncidenciasMes.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { GenerarIncidenciasMesUseCase } from '@/modules/asistencia/use-cases/generarIncidenciasMes.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { GenerarIncidenciasPeriodoDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el caso de uso GenerarIncidenciasMesUseCase (CU-17).
 * Se valida la consolidación mensual de incidencias (días computables, faltas, tardanzas)
 * sirviendo como base inmutable para el motor de cálculo de planillas (CU-20).
 */
describe('GenerarIncidenciasMesUseCase - Pruebas Unitarias Exhaustivas', () => {
    let useCase: GenerarIncidenciasMesUseCase;
    let prisma: PrismaService;

    //Mockeo de PrismaService para simular la base de datos sin afectar datos reales
    const mockPrisma = { empleados: { findMany: jest.fn() }, incidencias_mes: { upsert: jest.fn() } };

    //Dto válido para pruebas, representando un período de nómina típico
    const dtoValido: GenerarIncidenciasPeriodoDto = {periodo: '2026-09'};

    //Horario estándar de lunes a viernes, con tolerancia de 5 minutos
    const horarioEstandar = [
        { dia: 'LUNES', laborable: true, entrada: '08:00', salida: '17:00' },
        { dia: 'MARTES', laborable: true, entrada: '08:00', salida: '17:00' },
        { dia: 'MIERCOLES', laborable: true, entrada: '08:00', salida: '17:00' },
        { dia: 'JUEVES', laborable: true, entrada: '08:00', salida: '17:00' },
        { dia: 'VIERNES', laborable: true, entrada: '08:00', salida: '17:00' },
        { dia: 'SABADO', laborable: false, entrada: null, salida: null },
        { dia: 'DOMINGO', laborable: false, entrada: null, salida: null }
    ];

    //Configuración inicial de cada prueba, creando un módulo de prueba con el caso de uso y el servicio Prisma mockeado
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GenerarIncidenciasMesUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ]
        }).compile();

        useCase = module.get<GenerarIncidenciasMesUseCase>(GenerarIncidenciasMesUseCase);
        prisma = module.get<PrismaService>(PrismaService);

        jest.spyOn(IdentityGenerator, 'generateId').mockReturnValue('incidencia-uuid-001');
    });

    afterEach(() => jest.clearAllMocks());

    describe('Casos de Éxito (Happy Path)', () => {
        it('Debe consolidar un mes completo sin faltas ni tardanzas (Base 30 comercial)', async () => {
            //Arrange: Marcaciones puntuales de lunes a viernes, simulando un mes completo de asistencia
            const marcacionesPuntuales = [
                { tipo_marcacion: 'ENTRADA', fecha_hora: new Date('2026-09-01T13:02:00.000Z') }, //Martes 08:02 AM Lima (tolerancia 5m)
                { tipo_marcacion: 'ENTRADA', fecha_hora: new Date('2026-09-02T13:00:00.000Z') },
                { tipo_marcacion: 'ENTRADA', fecha_hora: new Date('2026-09-03T13:04:00.000Z') },
                { tipo_marcacion: 'ENTRADA', fecha_hora: new Date('2026-09-04T13:01:00.000Z') }
            ];

            //Mockeo de un empleado activo con marcaciones puntuales, sin solicitudes de ausencia
            const empleadoMock = {
                id: 'emp-uuid-1',
                nombre: 'Carlos',
                apellido: 'Mendoza',
                nro_documento: '72345678',
                fecha_inicio: new Date('2025-01-01'),
                fecha_cese: null,
                jornada: {
                    tolerancia_minutos: 5,
                    horario_semanal: horarioEstandar
                },
                solicitudes: [],
                asistencias: marcacionesPuntuales,
            };

            //Simular la respuesta de Prisma para devolver el empleado mockeado y la creación de la incidencia
            mockPrisma.empleados.findMany.mockResolvedValue([empleadoMock]);
            mockPrisma.incidencias_mes.upsert.mockResolvedValue({ id: 'incidencia-uuid-001' });

            //Act: Ejecutar el caso de uso con el DTO válido
            const resultado = await useCase.execute(dtoValido);

            //Assert: Validar que el resultado contenga la información esperada y que se haya llamado a Prisma con los parámetros correctos
            expect(resultado.total_procesados).toBe(1);
            expect(resultado.detalle[0]).toEqual(expect.objectContaining({
                empleado_id: 'emp-uuid-1',
                periodo: '2026-09',
                dias_computables: 12, //30 días comerciales menos 18 faltas
                faltas: 18, //Días laborables del mes no marcados en el mock simple
            }));

            //Verificar que Prisma haya sido llamado correctamente para crear o actualizar la incidencia del mes
            expect(mockPrisma.incidencias_mes.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: {
                    empleado_id_periodo: {
                        empleado_id: 'emp-uuid-1',
                        periodo: '2026-09'
                    }
                },
                create: expect.objectContaining({dias_trabajados: 12, estado: 'PENDIENTE'})
            }));
        });

        it('Debe justificar inasistencias si existen solicitudes aprobadas (Vacaciones / Descanso Médico)', async () => {
            //Arrange: Empleado con solicitud de vacaciones aprobada durante todo el mes
            const empleadoConVacaciones = {
                id: 'emp-uuid-2',
                nombre: 'Ana',
                apellido: 'Torres',
                nro_documento: '45678912',
                fecha_inicio: new Date('2024-06-01'),
                fecha_cese: null,
                jornada: {
                    tolerancia_minutos: 5,
                    horario_semanal: horarioEstandar
                },
                solicitudes: [{
                    estado: 'APROBADA',
                    fecha_inicio: new Date('2026-09-01T00:00:00.000Z'),
                    fecha_fin: new Date('2026-09-30T23:59:59.000Z')
                }],
                asistencias: []
            };

            //Mockeo de Prisma para devolver el empleado con vacaciones y simular la creación de la incidencia
            mockPrisma.empleados.findMany.mockResolvedValue([empleadoConVacaciones]);
            mockPrisma.incidencias_mes.upsert.mockResolvedValue({ id: 'incidencia-uuid-001' });

            //Act: Ejecutar el caso de uso con el DTO válido
            const resultado = await useCase.execute(dtoValido);

            //Assert: Validar que el resultado refleje 0 faltas y 30 días computables debido a la solicitud aprobada
            expect(resultado.detalle[0].faltas).toBe(0);
            expect(resultado.detalle[0].dias_computables).toBe(30);
        });
            

        it('Debe prorratear días base si el colaborador ingresó a mitad de mes (D.Leg 728)', async () => {
            //Arrange: Empleado que ingresó el 16 de septiembre, por lo que solo se computan los días restantes del mes
            //Ingresó el 16 de septiembre => le corresponden: 30 - (16 - 1) = 15 días base
            const empleadoIngresoMedio = {
                id: 'emp-uuid-3',
                nombre: 'Luis',
                apellido: 'Paredes',
                nro_documento: '78912345',
                fecha_inicio: new Date('2026-09-16T00:00:00.000Z'),
                fecha_cese: null,
                jornada: {
                    tolerancia_minutos: 5,
                    horario_semanal: horarioEstandar
                },
                solicitudes: [{
                    estado: 'APROBADA',
                    fecha_inicio: new Date('2026-09-16T00:00:00.000Z'),
                    fecha_fin: new Date('2026-09-30T23:59:59.000Z')
                }],
                asistencias: [],
            };

            //Mockeo de Prisma para devolver el empleado que ingresó a mitad de mes y simular la creación de la incidencia
            mockPrisma.empleados.findMany.mockResolvedValue([empleadoIngresoMedio]);
            mockPrisma.incidencias_mes.upsert.mockResolvedValue({ id: 'incidencia-uuid-001' });

            //Act: Ejecutar el caso de uso con el DTO válido
            const resultado = await useCase.execute(dtoValido);

            //Assert: Validar que el resultado refleje 15 días computables y 0 faltas debido a la solicitud aprobada
            expect(resultado.detalle[0].dias_computables).toBe(15);
            expect(resultado.detalle[0].faltas).toBe(0);
        });
    });

    describe('Filtros Opcionales', () => {
        it('Debe consultar filtrando por area_id o empleado_id cuando se proporcionan en el DTO', async () => {
            //Arrange: DTO con filtros opcionales para área y empleado
            const dtoConFiltros: GenerarIncidenciasPeriodoDto = {
                periodo: '2026-09',
                area_id: 'area-uuid-1',
                empleado_id: 'emp-uuid-1',
            };

            //Mockeo de Prisma para devolver un array vacío, simulando que no se encontraron empleados con los filtros proporcionados
            mockPrisma.empleados.findMany.mockResolvedValue([]);

            //Act & Assert: Ejecutar el caso de uso y esperar que lance NotFoundException debido a que no se encontraron empleados
            await expect(useCase.execute(dtoConFiltros)).rejects.toThrow(NotFoundException);

            //Assert: Verificar que Prisma haya sido llamado con los filtros correctos en la consulta
            expect(mockPrisma.empleados.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    activo: true,
                    id: 'emp-uuid-1',
                    area_id: 'area-uuid-1'
                })
            }));
        });
    });

    describe('Validaciones y Excepciones', () => {
        it('Debe lanzar NotFoundException si no existen colaboradores activos para el periodo', async () => {
            //Arrange: Mockeo de Prisma para devolver un array vacío, simulando que no se encontraron empleados activos
            mockPrisma.empleados.findMany.mockResolvedValue([]);

            //Act & Assert: Ejecutar el caso de uso y esperar que lance NotFoundException
            await expect(useCase.execute(dtoValido)).rejects.toThrow(NotFoundException);
            expect(mockPrisma.incidencias_mes.upsert).not.toHaveBeenCalled();
        });

        it('Debe transformar fallos no controlados de base de datos a InternalServerErrorException', async () => {
            //Arrange: Mockeo de Prisma para simular un fallo inesperado en la base de datos (timeout)
            mockPrisma.empleados.findMany.mockRejectedValue(new Error('PostgreSQL timeout'));

            //Act & Assert: Ejecutar el caso de uso y esperar que lance InternalServerErrorException
            await expect(useCase.execute(dtoValido)).rejects.toThrow(InternalServerErrorException);
        });
    });
});