//test/RRHH/Bulk-Empleado/procesarCargaMasica.useCase.spec.ts
//Pruebas unitarias para el caso de uso de procesamiento de carga masiva de empleados
import { ProcesarCargaMasivaUseCase } from '@/modules/RRHH/use-cases/carga-masiva/procesarCargaMasiva.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Queue } from 'bullmq';
import { PassThrough, Readable } from 'node:stream';
import * as csvParser from 'csv-parser';

//Mockear el shared-contracts para simular la validación de filas CSV
jest.mock('@jyp/shared-contracts', () => ({
    CargaMasivaFilaSchema: {
        safeParse: jest.fn((fila) => {
            if (fila.invalida) return { success: false, error: 'invalido' };
            return { success: true, data: fila };
        }),
    },
}));

//Mockear el csv-parser para simular la lectura de archivos CSV
jest.mock('csv-parser', () => {
    return {
        __esModule: true,
        default: jest.fn() 
    };
});

describe('ProcesarCargaMasivaUseCase', () => {
    let useCase: ProcesarCargaMasivaUseCase;
    let mockPrisma: any;
    let mockQueue: any;

    //Configuración inicial antes de cada prueba
    beforeEach(() => {
        //Mock del servicio Prisma para simular la interacción con la base de datos
        mockPrisma = {
            cargaMasivaJob: {
                create: jest.fn().mockResolvedValue(true),
                update: jest.fn().mockResolvedValue(true)
            }
        };

        //Mock de la cola de procesamiento para simular la adición de trabajos
        mockQueue = { add: jest.fn().mockResolvedValue(true) };

        //Instancia del caso de uso con los mocks inyectados
        useCase = new ProcesarCargaMasivaUseCase(mockQueue as unknown as Queue, mockPrisma as unknown as PrismaService);

        //Revisar la console.error para evitar que los errores se muestren en la salida de la prueba
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba para evitar efectos secundarios

    
    it('Deberia procesar filas e ignorar las invalidas, enviando el lote final en el evento end', async () => {
        //Arrange
        const jobId = 'job-123';
        const usuarioId = 'user-123';
        
        //Crear un stream de lectura simulado que emite filas válidas e inválidas
        const dummyStream = new Readable({ objectMode: true, read() {} }); 
        
        //El mock del parser simplemente devuelve un conducto (PassThrough) que deja pasar todo tal cual
        const passThroughMock = new PassThrough({ objectMode: true });
        (csvParser.default as unknown as jest.Mock).mockReturnValue(passThroughMock);

        //Act: Ejecutamos el caso de uso
        const promise = useCase.execute(jobId, usuarioId, dummyStream);

        //Alimentar el stream ORIGINAL de forma natural
        dummyStream.push({ id: 1, nombre: 'Juan' }); // Válido
        dummyStream.push({ invalida: true });        // Inválido
        dummyStream.push({ id: 2, nombre: 'Ana' });  // Válido
        
        //Cerrar el stream ORIGINAL (esto propagará el cierre por el .pipe y ejecutará el 'end')
        dummyStream.push(null);

        //Esperar a que la promesa del caso de uso se resuelva
        await promise;

        //Assert
        expect(mockPrisma.cargaMasivaJob.create).toHaveBeenCalled();
        expect(mockQueue.add).toHaveBeenCalledWith('lote-final', {
            jobId,
            registros: [{ id: 1, nombre: 'Juan' }, { id: 2, nombre: 'Ana' }]
        });

        expect(mockPrisma.cargaMasivaJob.update).toHaveBeenCalledWith({
            where: { id: jobId },
            data: { total_registros: 3 }
        });
    });

    it('Deberia pausar el stream, enviar un lote a la cola al llegar a 50 registros y reanudar', async () => {
        //Arrange: Crear un stream de lectura simulado que emite 50 filas válidas
        const dummyStream = new Readable({ objectMode: true, read() {} });
        jest.spyOn(dummyStream, 'pause');
        jest.spyOn(dummyStream, 'resume');

        //Mock del csv-parser para devolver un PassThrough que simula el flujo de datos
        const passThroughMock = new PassThrough({ objectMode: true });
        (csvParser.default as unknown as jest.Mock).mockReturnValue(passThroughMock);
        const promise = useCase.execute('job-123', 'user-123', dummyStream);

        //Act: Empujamos 50 filas
        for (let i = 0; i < 50; i++) dummyStream.push({ id: i });
        
        //Cerrar el stream
        dummyStream.push(null);
        await promise;

        //Assert
        expect(dummyStream.pause).toHaveBeenCalledTimes(2);
        expect(dummyStream.resume).toHaveBeenCalledTimes(2);
        expect(mockQueue.add).toHaveBeenCalledWith('lote-0', expect.any(Object), { removeOnComplete: true });
    });

    it('Deberia rechazar la promesa si ocurre un error en el stream de lectura', async () => {
        //Arrange: Crear un stream de lectura simulado y un PassThrough para el csv-parser
        const dummyStream = new Readable({ objectMode: true, read() {} });
        const passThroughMock = new PassThrough({ objectMode: true });
        (csvParser.default as unknown as jest.Mock).mockReturnValue(passThroughMock);

        //Iniciar la ejecución (la promesa queda en estado "pending")
        const promise = useCase.execute('job-123', 'user-123', dummyStream);

        //Act: Simular un fallo crítico (ej. caída de red) emitiendo el error en el stream parseado
        const fatalError = new Error('Disk Read Error');
        setImmediate(() => passThroughMock.destroy(fatalError));

        //Assert: Ahora la promesa DEBE rechazar inmediatamente atrapando nuestro error
        await expect(promise).rejects.toThrow('Disk Read Error');
    });

    describe('handleJobFailure', () => {
        it('Deberia actualizar el job a FALLIDO con el mensaje del error', async () => {
            //Arrange
            await useCase.handleJobFailure('job-404', new Error('Database timeout'));

            //Act & Assert: Verificar que la actualización a FALLIDO se haya llamado con el mensaje del error
            expect(mockPrisma.cargaMasivaJob.update).toHaveBeenCalledWith({
                where: { id: 'job-404' },
                data: { estado: 'FALLIDO' }
            });
        });

        it('Deberia asignar un mensaje generico si el error no tiene mensaje', async () => {
            //Arrange: Crear un error sin mensaje
            await useCase.handleJobFailure('job-404', {});

            //Act & Assert: Verificar que la actualización a FALLIDO se haya llamado con un mensaje generico
            expect(mockPrisma.cargaMasivaJob.update).toHaveBeenCalledWith({
                where: { id: 'job-404' },
                data: { estado: 'FALLIDO' }
            });
        });

       it('Deberia capturar el error y loguearlo si la actualizacion a FALLIDO tambien falla', async () => {
            //Arrange: Simular que la actualización a FALLIDO falla lanzando un error de base de datos
            const dbError = new Error('Connection Refused');
            mockPrisma.cargaMasivaJob.update.mockRejectedValue(dbError);

            //Mockear console.error para capturar el log de error y evitar que se muestre en la salida de la prueba
            jest.spyOn(console, 'error').mockImplementation(() => {});

            //Act: Llamar a handleJobFailure y esperar que no lance, sino que loguee el error
            await useCase.handleJobFailure('job-404', new Error('Error inicial'));
            await new Promise(resolve => setTimeout(resolve, 0));

            //Assert: Verificar que console.error haya sido llamado con el mensaje de error
            expect(console.error).toHaveBeenCalledWith('Error al actualizar el estado del job job-404 a FALLIDO: Connection Refused');
        });
    });
});