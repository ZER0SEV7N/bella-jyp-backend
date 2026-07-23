//test/RRHH/Bulk-Empleado/procesarCargaMasica.useCase.spec.ts
//Pruebas unitarias para el caso de uso de procesamiento de carga masiva de empleados
import { ProcesarCargaMasivaUseCase } from '@/modules/RRHH/use-cases/carga-masiva/procesarCargaMasiva.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Queue } from 'bullmq';
import { PassThrough, Readable } from 'node:stream';
import * as csvParser from 'csv-parser';
jest.mock('@jyp/shared-contracts', () => ({
    CargaMasivaFilaSchema: {
        safeParse: jest.fn((fila) => {
            // Simulamos que si la fila tiene la propiedad "invalida", falla la validación
            if (fila.invalida) return { success: false, error: 'invalido' };
            return { success: true, data: fila };
        }),
    },
}));

// 2. Mockeamos csv-parser para que retorne un Stream manipulable
jest.mock('csv-parser', () => {
    return {
        __esModule: true,
        default: jest.fn() // Inicializamos default como una función de jest
    };
});
describe('ProcesarCargaMasivaUseCase', () => {
    let useCase: ProcesarCargaMasivaUseCase;
    let mockPrisma: any;
    let mockQueue: any;

    //Arrange: Configuración de Mocks
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

    afterEach(() => {
        jest.clearAllMocks(); //Limpiar los mocks después de cada prueba para evitar efectos secundarios
    });
    
    it('Deberia procesar filas e ignorar las invalidas, enviando el lote final en el evento end', async () => {
        // Arrange
        const jobId = 'job-123';
        const usuarioId = 'user-123';
        
        // Creamos el stream en objectMode para poder pasarle objetos JSON directamente
        const dummyStream = new Readable({ objectMode: true, read() {} }); 
        
        // El mock del parser simplemente devuelve un conducto (PassThrough) que deja pasar todo tal cual
        const passThroughMock = new PassThrough({ objectMode: true });
        (csvParser.default as unknown as jest.Mock).mockReturnValue(passThroughMock);

        // Act: Ejecutamos el caso de uso
        const promise = useCase.execute(jobId, usuarioId, dummyStream);

        // Alimentamos el stream ORIGINAL de forma natural
        dummyStream.push({ id: 1, nombre: 'Juan' }); // Válido
        dummyStream.push({ invalida: true });        // Inválido
        dummyStream.push({ id: 2, nombre: 'Ana' });  // Válido
        
        // Cerramos el stream ORIGINAL (esto propagará el cierre por el .pipe y ejecutará el 'end')
        dummyStream.push(null);

        // Ahora sí, esperamos a que termine
        await promise;

        // Assert
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
        // Arrange
        const dummyStream = new Readable({ objectMode: true, read() {} });
        jest.spyOn(dummyStream, 'pause');
        jest.spyOn(dummyStream, 'resume');

        const passThroughMock = new PassThrough({ objectMode: true });
        (csvParser.default as unknown as jest.Mock).mockReturnValue(passThroughMock);

        const promise = useCase.execute('job-123', 'user-123', dummyStream);

        // Act: Empujamos 50 filas
        for (let i = 0; i < 50; i++) {
            dummyStream.push({ id: i });
        }
        // Cerramos el stream
        dummyStream.push(null);

        await promise;

        // Assert
        expect(dummyStream.pause).toHaveBeenCalledTimes(2);
        expect(dummyStream.resume).toHaveBeenCalledTimes(2);
        expect(mockQueue.add).toHaveBeenCalledWith('lote-0', expect.any(Object), { removeOnComplete: true });
    });

   it('Deberia rechazar la promesa si ocurre un error en el stream de lectura', async () => {
        // Arrange
        const dummyStream = new Readable({ objectMode: true, read() {} });
        
        // ¡ESTA ES LA LÍNEA MÁGICA! Evita que el error rebote y crashee el proceso de Node.
        dummyStream.on('error', () => {}); 

        const passThroughMock = new PassThrough({ objectMode: true });
        (csvParser.default as unknown as jest.Mock).mockReturnValue(passThroughMock);

        const promise = useCase.execute('job-123', 'user-123', dummyStream);

        // Act & Assert
        const fatalError = new Error('Disk Read Error');
        
        const expectPromise = expect(promise).rejects.toThrow(fatalError);
        passThroughMock.emit('error', fatalError);
        
        await expectPromise;
    });

    describe('handleJobFailure', () => {
        it('Deberia actualizar el job a FALLIDO con el mensaje del error', async () => {
            await useCase.handleJobFailure('job-404', new Error('Database timeout'));

            expect(mockPrisma.cargaMasivaJob.update).toHaveBeenCalledWith({
                where: { id: 'job-404' },
                data: { estado: 'FALLIDO', mensaje_error: 'Database timeout' }
            });
        });

        it('Deberia asignar un mensaje generico si el error no tiene mensaje', async () => {
            await useCase.handleJobFailure('job-404', {});

            expect(mockPrisma.cargaMasivaJob.update).toHaveBeenCalledWith({
                where: { id: 'job-404' },
                data: { estado: 'FALLIDO', mensaje_error: 'Error desconocido durante el procesamiento de la carga masiva.' }
            });
        });

       it('Deberia capturar el error y loguearlo si la actualizacion a FALLIDO tambien falla', async () => {
            const dbError = new Error('Connection Refused');
            mockPrisma.cargaMasivaJob.update.mockRejectedValue(dbError);

            useCase.handleJobFailure('job-404', new Error('Error inicial'));

            await new Promise(resolve => setTimeout(resolve, 0));

            expect(console.error).toHaveBeenCalledWith('Error al actualizar el estado del job job-404 a FALLIDO: Connection Refused');
        });
    });
});
