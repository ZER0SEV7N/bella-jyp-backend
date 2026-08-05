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
        { provide: ConsultarEstadoCargaMasivaUseCase, useValue: mockConsultarUseCase },
        { provide: ClsService, useValue: mockClsService },
      ],
    }).compile();

    controller = module.get<EmpleadoBulkController>(EmpleadoBulkController);
  });

  afterEach(() => jest.clearAllMocks()); //Limpiamos los mocks entre pruebas

  //====================================================================
  //PRUEBAS PARA: POST /api/rrhh/empleados/bulk (uploadBulk)
  //====================================================================
  describe('uploadBulk', () => {
    it('Deberia rebotar la peticion si no es multipart/form-data (Fail-Fast)', async () => {
      //Arrange: Simular una petición que no es multipart/form-data
      const mockRequest = { isMultipart: () => false } as FastifyRequest;
      const mockResponse = { status: jest.fn() } as unknown as FastifyReply;

      //Act & Assert: Llamamos al endpoint y esperamos que lance BadRequestException
      await expect(controller.uploadBulk(mockRequest, mockResponse)).rejects.toThrow(BadRequestException);
    });

    it('Deberia lanzar BadRequestException si no se encontró ningún archivo en la petición', async () => {
      //Arrange: Simular una petición multipart/form-data pero sin archivos adjuntos
      const mockRequest = {
        isMultipart: () => true,
        file: jest.fn().mockResolvedValue(undefined),
      } as unknown as FastifyRequest;
      const mockResponse = { status: jest.fn() } as unknown as FastifyReply;

      //Act & Assert: Llamamos al endpoint y esperamos que lance BadRequestException
      await expect(controller.uploadBulk(mockRequest, mockResponse)).rejects.toThrow('No se encontró ningún archivo en la petición.');
    });

    it('Deberia lanzar BadRequestException si el archivo no es de tipo CSV', async () => {
      //Arrange: Simular que se subió un archivo, pero es un PDF
      const mockFile = {
        mimetype: 'application/pdf',
        file: { pipe: jest.fn() },
      };
      const mockRequest = {
        isMultipart: () => true,
        file: jest.fn().mockResolvedValue(mockFile),
      } as unknown as FastifyRequest;
      const mockResponse = { status: jest.fn() } as unknown as FastifyReply;

      //Act & Assert: Llamar al endpoint y esperamos que lance BadRequestException
      await expect(controller.uploadBulk(mockRequest, mockResponse)).rejects.toThrow('El archivo debe ser de tipo CSV.');
    });

    it('Deberia retornar 202 Accepted e invocar el caso de uso correctamente', async () => {
      //Arrange: Simular la subida de un archivo CSV válido
      const mockFile = { mimetype: 'text/csv', file: { pipe: jest.fn() } };
      const mockRequest = {
        isMultipart: () => true,
        file: jest.fn().mockResolvedValue(mockFile),
      } as unknown as FastifyRequest;
      const mockResponse = { status: jest.fn() } as unknown as FastifyReply;

      //Act: Llamar al endpoint con un archivo CSV válido
      const result = await controller.uploadBulk(mockRequest, mockResponse);

      //Assert: Validar que el status de la respuesta sea 202 y que el caso de uso fue invocado correctamente
      expect(mockResponse.status).toHaveBeenCalledWith(202);
      expect(result.status).toBe(202);
      expect(result).toHaveProperty('jobId');
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
      //Act & Assert: Llamamos al endpoint GET sin jobId y esperamos que lance BadRequestException
      await expect(controller.getBulkStatus('')).rejects.toThrow('El parámetro jobId es obligatorio.');
    });
  });

  it('Deberia retornar la data del estado del job y el timestamp correctamente', async () => {
    //Arrange: Configurar el mock para simular la respuesta del caso de uso    
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

    //Act: Llamar al endpoint GET con un jobId válido
    const result = await controller.getBulkStatus(mockJobId);

    //Assert: Validar que el caso de uso fue invocado correctamente y que la respuesta contiene los datos esperados
    expect(mockConsultarUseCase.execute).toHaveBeenCalledWith(mockJobId, 'user-uuid-123');
    expect(result.data).toEqual(mockStatusData);
    expect(result).toHaveProperty('timestamp');
  });
});
