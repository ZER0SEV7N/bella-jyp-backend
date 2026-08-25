//test/workers/carga-masiva/carga-masiva.processor.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CargaMasivaProcessor } from '@/workers/carga-masiva/carga-masiva.processor';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ProcesarFilaEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase';
import { Job } from 'bullmq';
import { CargaMasivaFilaDTO } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias para el CargaMasivaProcessor.
 * Estas pruebas validan el comportamiento del worker de BullMQ encargado de procesar lotes de filas para la carga masiva de empleados.
 * Se incluyen pruebas para verificar el flujo exitoso de procesamiento, manejo de errores individuales por fila, 
 * y la transición correcta de estados del job en la base de datos.
 * Se asegura que los métodos del use case y del servicio Prisma sean llamados con los parámetros esperados.
 */
describe('CargaMasivaProcessor - Pruebas Unitarias del Worker de BullMQ', () => {
  let processor: CargaMasivaProcessor;
  let prismaService: PrismaService;
  let procesarFilaEmpleadoUseCase: ProcesarFilaEmpleadoUseCase;

  //Mock de Job ID para pruebas
  const mockJobId = 'job-uuid-100';

  //Mock de PrismaService y ProcesarFilaEmpleadoUseCase
  const mockPrismaService = {
    cargaMasivaJob: {
      update: jest.fn(),
      findUnique: jest.fn()
    },
  };

  //Mock del use case para simular el procesamiento de filas
  const mockProcesarFilaUseCase = {execute: jest.fn()};

  //Configuracion previa a cada prueba: Creación del módulo de prueba y obtención de instancias
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CargaMasivaProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProcesarFilaEmpleadoUseCase, useValue: mockProcesarFilaUseCase }
      ]
    }).compile();

    processor = module.get<CargaMasivaProcessor>(CargaMasivaProcessor);
    prismaService = module.get<PrismaService>(PrismaService);
    procesarFilaEmpleadoUseCase = module.get<ProcesarFilaEmpleadoUseCase>(ProcesarFilaEmpleadoUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  //Prueba del proceso de un lote de filas, verificando la transición de estados y el manejo de errores
  describe('process() - Procesamiento de Lotes y Transición de Estados', () => {
    it('Debe procesar exitosamente un lote de filas y marcar el job como COMPLETADO al finalizar', async () => {
      //Arrange: Simulación de un job con varias filas a procesar
      const registros: CargaMasivaFilaDTO[] = [
        {
          tipo_documento: 'DNI',
          nro_documento: '70998877',
          nombre: 'Roberto',
          apellido: 'Flores Gomez',
          asig_familiar: false,
          cargo: 'Asistente',
          area: 'Administración'
        },
        {
          tipo_documento: 'CE',
          nro_documento: '002233445',
          nombre: 'Luis',
          apellido: 'Paredes Soto',
          asig_familiar: false,
          cargo: 'Asistente',
          area: 'Administración'
        },
      ];

      //mock de job de BullMQ con datos simulados
      const mockJob = {
        name: 'lote-final',
        data: { jobId: mockJobId, registros }
      } as Job<{ jobId: string; registros: CargaMasivaFilaDTO[] }>;

      //Act: Llamada al método process del processor
      //Mock de PrismaService y use case para simular el flujo exitoso
      mockPrismaService.cargaMasivaJob.update.mockResolvedValue({ id: mockJobId });
      mockProcesarFilaUseCase.execute.mockResolvedValue(undefined);
      
      mockPrismaService.cargaMasivaJob.findUnique.mockResolvedValue({
        id: mockJobId,
        total_registros: 2,
        procesados: 0,
        fallidos: 0,
        errores_detalle: [],
      });

      await processor.process(mockJob);

      //Assert: Verificación de llamadas y parámetros esperados
      //Verificación de cambio inicial a PROCESANDO
      expect(prismaService.cargaMasivaJob.update).toHaveBeenNthCalledWith(1, {
        where: { id: mockJobId },
        data: { estado: 'PROCESANDO' }
      });

      //Verificación de llamadas por cada fila
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenCalledTimes(2);
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenNthCalledWith(1, registros[0], mockJobId);
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenNthCalledWith(2, registros[1], mockJobId);

      //Verificación de actualización final a COMPLETADO
      expect(prismaService.cargaMasivaJob.update).toHaveBeenNthCalledWith(2, {
        where: { id: mockJobId },
        data: {
          procesados: 2,
          fallidos: 0,
          errores_detalle: [],
          estado: 'COMPLETADO'
        }
      });
    });

    it('Debe capturar excepciones individuales por fila, incrementar fallidos y registrar el detalle', async () => {
      //Arrange: Simulación de un job con varias filas, donde una fila falla
      const registros: CargaMasivaFilaDTO[] = [
        {
          tipo_documento: 'DNI',
          nro_documento: '70998877',
          asig_familiar: false,
          cargo: 'Asistente',
          area: 'Administración',
        },
        {
          tipo_documento: 'DNI',
          nro_documento: '00000000',
          asig_familiar: false,
          cargo: 'Asistente',
          area: 'Administración',
        },
      ];

      //mock de job de BullMQ con datos simulados
      const mockJob = {
        name: 'lote-0',
        data: { jobId: mockJobId, registros },
      } as Job<{ jobId: string; registros: CargaMasivaFilaDTO[] }>;

      //Act: Mock de PrismaService y use case para simular el flujo con error en la segunda fila
      mockPrismaService.cargaMasivaJob.update.mockResolvedValue({ id: mockJobId });

      //Primera fila exitosa, segunda falla
      mockProcesarFilaUseCase.execute
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('DNI no encontrado en RENIEC'));

      mockPrismaService.cargaMasivaJob.findUnique.mockResolvedValue({
        id: mockJobId,
        total_registros: 10, // Lote intermedio (quedan filas pendientes)
        procesados: 0,
        fallidos: 0,
        errores_detalle: [],
      });

      await processor.process(mockJob);

      //Assert: Verificación de llamadas y parámetros esperados
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenCalledTimes(2);
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenNthCalledWith(1, registros[0], mockJobId);
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenNthCalledWith(2, registros[1], mockJobId);
      expect(prismaService.cargaMasivaJob.update).toHaveBeenNthCalledWith(2, {
        where: { id: mockJobId },
        data: {
          procesados: 1,
          fallidos: 1,
          errores_detalle: [{ Dni: '00000000', causa: 'DNI no encontrado en RENIEC' }],
          estado: 'PROCESANDO'
        }
      });
    });

    it('Debe marcar estado FALLIDO si todas las filas del archivo fallan', async () => {
      //Arrange: Simulación de un job con una sola fila que falla
      const registros: CargaMasivaFilaDTO[] = [
        {
          tipo_documento: 'DNI',
          nro_documento: '11111111',
          asig_familiar: false,
          cargo: 'Asistente',
          area: 'Administración'
        }
      ];

      const mockJob = {
        name: 'lote-final',
        data: { jobId: mockJobId, registros }
      } as Job<{ jobId: string; registros: CargaMasivaFilaDTO[] }>;

      //Act: Mock de PrismaService y use case para simular el flujo con error en la única fila
      mockPrismaService.cargaMasivaJob.update.mockResolvedValue({ id: mockJobId });
      mockProcesarFilaUseCase.execute.mockRejectedValue(new Error('Error de concurrencia en BD'));

      mockPrismaService.cargaMasivaJob.findUnique.mockResolvedValue({
        id: mockJobId,
        total_registros: 1,
        procesados: 0,
        fallidos: 0,
        errores_detalle: []
      });

      await processor.process(mockJob);

      //Assert: Verificación de llamadas y parámetros esperados+
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenCalledTimes(1);
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenNthCalledWith(1, registros[0], mockJobId);
      expect(prismaService.cargaMasivaJob.update).toHaveBeenNthCalledWith(2, {
        where: { id: mockJobId },
        data: {
          procesados: 0,
          fallidos: 1,
          errores_detalle: [{ Dni: '11111111', causa: 'Error de concurrencia en BD' }],
          estado: 'FALLIDO'
        },
      });
    });

    it('Debe ignorar la actualización final si el job ya no existe en la BD', async () => {
      //Arrange: Simulación de un job con una sola fila, pero el job es eliminado antes de la actualización final
      const registros: CargaMasivaFilaDTO[] = [
        {
          tipo_documento: 'DNI',
          nro_documento: '70998877',
          asig_familiar: false,
          cargo: 'Asistente',
          area: 'Administración'
        }
      ];

      const mockJob = {
        name: 'lote-0',
        data: { jobId: mockJobId, registros },
      } as Job<{ jobId: string; registros: CargaMasivaFilaDTO[] }>;

      //Act: Mock de PrismaService y use case para simular el flujo exitoso, pero el job es eliminado antes de la actualización final
      mockPrismaService.cargaMasivaJob.update.mockResolvedValue({ id: mockJobId });
      mockProcesarFilaUseCase.execute.mockResolvedValue(undefined);
      mockPrismaService.cargaMasivaJob.findUnique.mockResolvedValue(null);

      await processor.process(mockJob);

      //Assert: Verificación de llamadas y parámetros esperados
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenCalledTimes(1);
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenNthCalledWith(1, registros[0], mockJobId);
      expect(prismaService.cargaMasivaJob.update).toHaveBeenCalledTimes(1); //Solo la llamada inicial a PROCESANDO
    });
  });
});