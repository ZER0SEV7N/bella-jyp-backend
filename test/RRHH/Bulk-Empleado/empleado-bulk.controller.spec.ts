//test/RRHH/Bulk-Empleado/empleado-bulk.controller.spec.ts
//Pruebas Unitarias para el controlador de carga masiva de empleados
//Importaciones necesarias para las pruebas
import { Test, TestingModule } from '@nestjs/testing';
import { EmpleadoBulkController } from '@/modules/RRHH/controller/empleado-bulk.controller';
import { ProcesarCargaMasivaUseCase } from '@/modules/RRHH/use-cases/carga-masiva/procesarCargaMasiva.useCase';
import { ConsultarEstadoCargaMasivaUseCase } from '@/modules/RRHH/use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase';
import { ClsService } from 'nestjs-cls';
import { BadRequestException } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

describe('EmpleadoBulkController', () => {
  let controller: EmpleadoBulkController;

  //Arrange: Configuracion de Mocks
  const mockProcesarUseCase = {
    execute: jest.fn().mockResolvedValue(undefined), //Simula la ejecución exitosa del caso de uso
    handleJobFailure: jest.fn(), //Simula el manejo de fallos en el caso de uso
  };

  const mockConsultarUseCase = { execute: jest.fn() }; // Añadimos el mock para el endpoint GET

  //Mock para el CLS (Context Local Storage) Service, que simula la obtención del ID del usuario desde el contexto
  const mockClsService = { get: jest.fn().mockReturnValue('user-uuid-123') };

  beforeEach(async () => {
    //Describe la configuración del módulo de pruebas, inyectando los mocks en lugar de las implementaciones reales
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmpleadoBulkController],
      providers: [
        { provide: ProcesarCargaMasivaUseCase, useValue: mockProcesarUseCase },
        {
          provide: ConsultarEstadoCargaMasivaUseCase,
          useValue: mockConsultarUseCase,
        },
        { provide: ClsService, useValue: mockClsService },
      ],
    }).compile();

    controller = module.get<EmpleadoBulkController>(EmpleadoBulkController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  }); //Limpiamos los mocks entre pruebas

  //====================================================================
  //PRUEBAS PARA: POST /api/rrhh/empleados/bulk (uploadBulk)
  //====================================================================
  describe('uploadBulk', () => {
    it('Deberia rebotar la peticion si no es multipart/form-data (Fail-Fast)', async () => {
      const mockRequest = { isMultipart: () => false } as FastifyRequest;
      const mockResponse = { status: jest.fn() } as unknown as FastifyReply;

      await expect(
        controller.uploadBulk(mockRequest, mockResponse),
      ).rejects.toThrow(BadRequestException);
    });

    it('Deberia lanzar BadRequestException si no se encontró ningún archivo en la petición', async () => {
      // Simulamos que es multipart, pero data.file() retorna undefined
      const mockRequest = {
        isMultipart: () => true,
        file: jest.fn().mockResolvedValue(undefined),
      } as unknown as FastifyRequest;
      const mockResponse = { status: jest.fn() } as unknown as FastifyReply;

      await expect(
        controller.uploadBulk(mockRequest, mockResponse),
      ).rejects.toThrow('No se encontró ningún archivo en la petición.');
    });

    it('Deberia lanzar BadRequestException si el archivo no es de tipo CSV', async () => {
      // Simulamos que se subió un archivo, pero es un PDF
      const mockFile = {
        mimetype: 'application/pdf',
        file: { pipe: jest.fn() },
      };
      const mockRequest = {
        isMultipart: () => true,
        file: jest.fn().mockResolvedValue(mockFile),
      } as unknown as FastifyRequest;
      const mockResponse = { status: jest.fn() } as unknown as FastifyReply;

      await expect(
        controller.uploadBulk(mockRequest, mockResponse),
      ).rejects.toThrow('El archivo debe ser de tipo CSV.');
    });

    it('Deberia retornar 202 Accepted e invocar el caso de uso correctamente', async () => {
      const mockFile = { mimetype: 'text/csv', file: { pipe: jest.fn() } };
      const mockRequest = {
        isMultipart: () => true,
        file: jest.fn().mockResolvedValue(mockFile),
      } as unknown as FastifyRequest;
      const mockResponse = { status: jest.fn() } as unknown as FastifyReply;

      const result = await controller.uploadBulk(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(202);
      expect(result.status).toBe(202);
      expect(result).toHaveProperty('jobId');
      //Validamos que el procesamiento en segundo plano fue llamado con el stream del archivo
      expect(mockProcesarUseCase.execute).toHaveBeenCalledWith(
        expect.any(String), //jobId generado dinámicamente
        'user-uuid-123', //ID del usuario inyectado por el CLS
        mockFile.file, //El stream del archivo
      );
    });
  });

  //====================================================================
  //PRUEBAS PARA: GET /api/rrhh/empleados/bulk/:jobId (getBulkStatus)
  //====================================================================
  describe('getBulkStatus', () => {
    it('Deberia lanzar BadRequestException si no se proporciona jobId', async () => {
      await expect(controller.getBulkStatus('')).rejects.toThrow(
        'El parámetro jobId es obligatorio.',
      );
    });
  });

  it('Deberia retornar la data del estado del job y el timestamp correctamente', async () => {
    const mockJobId = 'job-12345';
    const mockStatusData = {
      id: mockJobId,
      estado: 'PROCESANDO',
      total_registros: 1000,
      procesados: 450,
      fallidos: 10,
    };

    //Simular la ejecución del caso de uso para retornar datos de estado
    mockConsultarUseCase.execute.mockResolvedValue(mockStatusData);

    //Act: Llamamos al endpoint GET con un jobId válido
    const result = await controller.getBulkStatus(mockJobId);

    //Validamos que el caso de uso fue llamado con los parámetros correctos
    expect(mockConsultarUseCase.execute).toHaveBeenCalledWith(
      mockJobId,
      'user-uuid-123',
    );
    expect(result.data).toEqual(mockStatusData);
    expect(result).toHaveProperty('timestamp');
  });
});
