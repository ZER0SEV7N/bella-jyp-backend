//test/workers/carga-masiva/carga-masiva.processor.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CargaMasivaProcessor } from '@/workers/carga-masiva/carga-masiva.processor';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ProcesarFilaEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase';
import { Job } from 'bullmq';
import type { CargaMasivaFilaDTO } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias para el worker de BullMQ encargado de procesar la carga masiva de empleados.
 * Se simula el comportamiento de las dependencias externas (PrismaService y ProcesarFilaEmpleadoUseCase)
 * para verificar que el worker maneja correctamente la lógica de procesamiento, incluyendo:
 */
describe('CargaMasivaProcessor - Pruebas Unitarias del Worker de BullMQ', () => {
  //Variables compartidas para las pruebas
  let processor: CargaMasivaProcessor;
  let prismaService: PrismaService;
  let procesarFilaEmpleadoUseCase: ProcesarFilaEmpleadoUseCase;

  //Id unico
  const mockJobId = 'job-uuid-100';

  //Mockear el servicio de Prisma y el caso de uso de procesamiento de fila
  const mockPrismaService = {
    cargaMasivaJob: { update: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(async (cb: any) => {
      if (typeof cb === 'function') return await cb(mockPrismaService);
      return Promise.all(cb);
    }),
  };

  //Mockear el caso de uso de procesamiento de fila
  const mockProcesarFilaUseCase = { execute: jest.fn() };

  //Fila base para las pruebas
  const filaBaseMock: CargaMasivaFilaDTO = {
    tipo_documento: 'DNI',
    nro_documento: '70998877',
    nombre: 'Roberto',
    apellido: 'Flores Gomez',
    sexo: 'MASCULINO',
    estado_civil: 'SOLTERO',
    fecha_nacimiento: '1992-04-10',
    direccion: 'Av. Las Begonias 450',
    departamento: 'LIMA',
    provincia: 'LIMA',
    distrito: 'SAN ISIDRO',
    fecha_inicio: '2024-01-01',
    asig_familiar: false,
    area: 'Administración',
    cargo: 'Asistente',
    sueldo_basico: 2500,
    regimen_pension: 'ONP',
    regimen_salud: 'ESSALUD_REGULAR',
    eps_costo_adicional: 0,
    tipo_cuenta_sueldo: 'SUELDO',
    tipo_cuenta_cts: 'AHORROS'
  };

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CargaMasivaProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProcesarFilaEmpleadoUseCase, useValue: mockProcesarFilaUseCase },
      ]
    }).compile();

    processor = module.get<CargaMasivaProcessor>(CargaMasivaProcessor);
    prismaService = module.get<PrismaService>(PrismaService);
    procesarFilaEmpleadoUseCase = module.get<ProcesarFilaEmpleadoUseCase>(ProcesarFilaEmpleadoUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  describe('process() - Procesamiento de Lotes y Transición de Estados', () => {
    it('Debe procesar exitosamente un lote de filas y marcar el job como COMPLETADO al finalizar', async () => {
      //Arrange: Crear un job simulado con varias filas de empleados
      const registros: CargaMasivaFilaDTO[] = [
        { ...filaBaseMock, nro_documento: '70998877' },
        { ...filaBaseMock, nro_documento: '002233445', tipo_documento: 'CE' }
      ];

      //Crear un job simulado con varias filas de empleados
      const mockJob = { name: 'lote-final', data: { jobId: mockJobId, registros } } as Job<{ jobId: string; registros: CargaMasivaFilaDTO[] }>;

      //Mockear las respuestas de Prisma y del caso de uso
      mockPrismaService.cargaMasivaJob.update.mockResolvedValue({ id: mockJobId });
      mockProcesarFilaUseCase.execute.mockResolvedValue(undefined);

      //Mockear la respuesta de findUnique para simular que el job existe en la base de datos
      mockPrismaService.cargaMasivaJob.findUnique.mockResolvedValue({
        id: mockJobId,
        total_registros: 2,
        procesados: 0,
        fallidos: 0,
        errores_detalle: []
      });

      //Act: Ejecutar el método process del worker
      await processor.process(mockJob);

      //Assert: Verificar que se haya actualizado el estado del job a PROCESANDO al inicio
      expect(prismaService.cargaMasivaJob.update).toHaveBeenNthCalledWith(1, {
        where: { id: mockJobId },
        data: { estado: 'PROCESANDO' }
      });

      //Verificar que se haya llamado al caso de uso de procesamiento de fila para cada registro
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenCalledTimes(2);
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenNthCalledWith(1, registros[0], mockJobId);
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenNthCalledWith(2, registros[1], mockJobId);

      //Verificar que se haya actualizado el estado del job a COMPLETADO al finalizar
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
      //Arrange: Crear un job simulado con varias filas de empleados, una de las cuales fallará
      const registros: CargaMasivaFilaDTO[] = [
        { ...filaBaseMock, nro_documento: '70998877' },
        { ...filaBaseMock, nro_documento: '00000000' }
      ];

      //Crear un job simulado con varias filas de empleados
      const mockJob = { name: 'lote-0', data: { jobId: mockJobId, registros } } as Job<{ jobId: string; registros: CargaMasivaFilaDTO[] }>;

      //Mockear las respuestas de Prisma y del caso de uso
      mockPrismaService.cargaMasivaJob.update.mockResolvedValue({ id: mockJobId });

      //Mockear el caso de uso para que la primera fila se procese correctamente y la segunda falle
      mockProcesarFilaUseCase.execute.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('DNI no encontrado en RENIEC'));

      //Mockear la respuesta de findUnique para simular que el job existe en la base de datos
      mockPrismaService.cargaMasivaJob.findUnique.mockResolvedValue({
        id: mockJobId,
        total_registros: 10,
        procesados: 0,
        fallidos: 0,
        errores_detalle: []
      });

      //Act: Ejecutar el método process del worker
      await processor.process(mockJob);

      //Assert: Verificar que se haya llamado al caso de uso de procesamiento de fila para cada registro
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenCalledTimes(2);
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
      //Arrange: Crear un job simulado con una fila de empleado que fallará
      const registros: CargaMasivaFilaDTO[] = [{ ...filaBaseMock, nro_documento: '11111111' }];

      //Crear un job simulado con una fila de empleado que fallará
      const mockJob = { name: 'lote-final', data: { jobId: mockJobId, registros } } as Job<{ jobId: string; registros: CargaMasivaFilaDTO[] }>;

      //Mockear las respuestas de Prisma y del caso de uso
      mockPrismaService.cargaMasivaJob.update.mockResolvedValue({ id: mockJobId });
      mockProcesarFilaUseCase.execute.mockRejectedValue(new Error('Error de concurrencia en BD'));

      //Mockear la respuesta de findUnique para simular que el job existe en la base de datos
      mockPrismaService.cargaMasivaJob.findUnique.mockResolvedValue({
        id: mockJobId,
        total_registros: 1,
        procesados: 0,
        fallidos: 0,
        errores_detalle: []
      });

      //Act: Ejecutar el método process del worker
      await processor.process(mockJob);

      //Assert: Verificar que se haya llamado al caso de uso de procesamiento de fila para cada registro
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenCalledTimes(1);
      expect(prismaService.cargaMasivaJob.update).toHaveBeenNthCalledWith(2, {
        where: { id: mockJobId },
        data: {
          procesados: 0,
          fallidos: 1,
          errores_detalle: [{ Dni: '11111111', causa: 'Error de concurrencia en BD' }],
          estado: 'FALLIDO'
        }
      });
    });

    it('Debe ignorar la actualización final si el job ya no existe en la BD', async () => {
      //Arrange: Crear un job simulado con una fila de empleado 
      const registros: CargaMasivaFilaDTO[] = [{ ...filaBaseMock }];

      //Crear un job simulado con una fila de empleado
      const mockJob = { name: 'lote-0', data: { jobId: mockJobId, registros } } as Job<{ jobId: string; registros: CargaMasivaFilaDTO[] }>;

      //Mockear las respuestas de Prisma y del caso de uso
      mockPrismaService.cargaMasivaJob.update.mockResolvedValue({ id: mockJobId });
      mockProcesarFilaUseCase.execute.mockResolvedValue(undefined);
      mockPrismaService.cargaMasivaJob.findUnique.mockResolvedValue(null);

      //Act: Ejecutar el método process del worker
      await processor.process(mockJob);

      //Assert: Verificar que se haya llamado al caso de uso de procesamiento de fila para cada registro
      expect(procesarFilaEmpleadoUseCase.execute).toHaveBeenCalledTimes(1);
      expect(prismaService.cargaMasivaJob.update).toHaveBeenCalledTimes(1);
    });
  });
});