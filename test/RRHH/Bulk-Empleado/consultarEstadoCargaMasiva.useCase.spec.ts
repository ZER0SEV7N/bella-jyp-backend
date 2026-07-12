//test/RRHH/Bulk-Empleado/consultarEstadoCargaMasiva.useCase.spec.ts
//Pruebas unitarias para el caso de uso de consulta de estado de carga masiva de empleados
//Importaciones necesarias para las pruebas
import { Test, TestingModule } from '@nestjs/testing';
import { ConsultarEstadoCargaMasivaUseCase } from '@/modules/RRHH/use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ConsultarEstadoCargaMasivaUseCase', () =>{
    let useCase: ConsultarEstadoCargaMasivaUseCase;
    let prisma: PrismaService;

    //Arrange: Configuración de Mocks
    const mockPrisma = { cargaMasivaJob: { findFirst: jest.fn() } };

    //Act: Configuración del módulo de pruebas y la inyección de dependencias
    beforeEach(async () => {
        //Configura el modulo de pruebas
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConsultarEstadoCargaMasivaUseCase,
                { provide: PrismaService, useValue: mockPrisma }
            ],
        }).compile();

        //Obtiene las instancias del caso de uso y del servicio Prisma
        useCase = module.get<ConsultarEstadoCargaMasivaUseCase>(ConsultarEstadoCargaMasivaUseCase);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks(); //Limpia los mocks después de cada prueba
    })

    it('Deberia retornar la información del job si existe y pertenece al usuario', async () => {
        //Arrange: Datos simulados
        const jobId = 'job-uuid-123';
        const usuarioId = 'user-uuid-123';
        
        const mockJobResult = {
            id: jobId,
            estado: 'PROCESANDO',
            total_registros: 100,
            procesados: 50,
            fallidos: 2,
            errores_detalle: null,
            updated_at: new Date(),
        };

        //Simulamos que Prisma encuentra el registro
        mockPrisma.cargaMasivaJob.findFirst.mockResolvedValue(mockJobResult);

        //Act: Ejecutamos el caso de uso
        const result = await useCase.execute(jobId, usuarioId);

        //Assert: Verificamos que Prisma fue llamado con la consulta exacta (seguridad incluida)
        expect(mockPrisma.cargaMasivaJob.findFirst).toHaveBeenCalledWith({
            where: {
                id: jobId,
                usuario_id: usuarioId, //Validamos que el ID del usuario se esté enviando
            },
            select: {
                id: true,
                estado: true,
                total_registros: true,
                procesados: true,
                fallidos: true,
                errores_detalle: true,
                updated_at: true,
            },
        });
        
        //Verificamos que el resultado retornado sea el correcto
        expect(result).toEqual(mockJobResult);
    });

    it('Deberia lanzar NotFoundException si el job no existe o no pertenece al usuario', async () => {
        //Arrange: Datos simulados
        const jobId = 'job-uuid-404';
        const usuarioId = 'user-uuid-404';

        //Simulamos que Prisma no encuentra el registro (retorna null)
        mockPrisma.cargaMasivaJob.findFirst.mockResolvedValue(null);

        //Act & Assert: Esperamos que la promesa sea rechazada y lance la excepción exacta
        await expect(useCase.execute(jobId, usuarioId)).rejects.toThrow(NotFoundException);
        await expect(useCase.execute(jobId, usuarioId)).rejects.toThrow(`El lote de carga masiva con ID ${jobId} no existe o no te pertenece.` );

        //Validamos que la consulta a base de datos sí intentó ejecutarse
        expect(mockPrisma.cargaMasivaJob.findFirst).toHaveBeenCalledTimes(2); //Se llama dos veces por los dos expects
    });
});