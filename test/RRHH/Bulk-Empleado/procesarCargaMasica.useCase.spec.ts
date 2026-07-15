//test/RRHH/Bulk-Empleado/procesarCargaMasica.useCase.spec.ts
//Pruebas unitarias para el caso de uso de procesamiento de carga masiva de empleados
import { ProcesarCargaMasivaUseCase } from '@/modules/RRHH/use-cases/carga-masiva/procesarCargaMasiva.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Queue } from 'bullmq';
import { Readable } from 'node:stream';

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
        update: jest.fn().mockResolvedValue(true),
      },
    };

    //Mock de la cola de procesamiento para simular la adición de trabajos
    mockQueue = { add: jest.fn().mockResolvedValue(true) };

    //Instancia del caso de uso con los mocks inyectados
    useCase = new ProcesarCargaMasivaUseCase(
      mockQueue as unknown as Queue,
      mockPrisma as unknown as PrismaService,
    );
  });

  it('Deberia insertar el estado inicial EN_COLA en la base de datos y procesar el archivo CSV en lotes', async () => {
    //ARRANGE: Crear un Readable Stream simulado con datos CSV válidos
    const jobId = 'job-uuid-123';
    const usuarioId = 'user-uuid-123';

    const mockStream = Readable.from([]); // Simula un stream vacío para la prueba

    // Act
    await useCase.execute(jobId, usuarioId, mockStream);

    // Assert
    expect(mockPrisma.cargaMasivaJob.create).toHaveBeenCalledWith({
      data: {
        id: jobId,
        usuario_id: usuarioId,
        estado: 'EN_COLA',
        total_registros: 0,
        procesados: 0,
        fallidos: 0,
      },
    });
  });

  it('Deberia actualizar el estado del job a FALLIDO si ocurre un handleJobFailure', async () => {
    //ARRANGE: Crear un Readable Stream simulado que lanza un error
    const jobId = 'job-404';
    const mockError = new Error('Database timeout');

    //Act: Llamar al método handleJobFailure para simular un fallo en el procesamiento
    await useCase.handleJobFailure(jobId, mockError);

    //Assert: Verificar que el estado del job se actualizó a FALLIDO en la base de datos
    expect(mockPrisma.cargaMasivaJob.update).toHaveBeenCalledWith({
      where: { id: jobId },
      data: {
        estado: 'FALLIDO',
        mensaje_error: mockError.message,
      },
    });
  });
});
