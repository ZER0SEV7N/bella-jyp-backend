//test/modules/RRHH/organizacion/Bulk-Empleado/empleado-bulk.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EmpleadoBulkController } from '@/modules/RRHH/organizacion/controller/empleado-bulk.controller';
import { ConsultarEstadoCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase';
import { ValidarCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/validarCargaMasiva.useCase';
import { ConfirmarCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/confirmarCargaMasiva.useCase';
import { ClsService } from 'nestjs-cls';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Pruebas unitarias para el controlador EmpleadoBulkController, que maneja la carga masiva de empleados desde un archivo CSV.
 * Estas pruebas verifican el comportamiento del controlador en escenarios de éxito y error.
 * Se simula la interacción con los casos de uso (UseCases) mediante mocks para evitar dependencias externas.
 * Se valida que los endpoints respondan correctamente según las reglas de negocio definidas.
 * También se prueban los casos de error, incluyendo validaciones de payload y formatos de archivo.
 */
describe('EmpleadoBulkController - Pruebas Unitarias de Endpoints HTTP', () => {
  let controller: EmpleadoBulkController;
  //Mocks para los casos de uso y servicios inyectados en el controlador
  const mockConsultarUseCase = { execute: jest.fn() };
  const mockValidarUseCase = { execute: jest.fn() };
  const mockConfirmarUseCase = { execute: jest.fn() };
  const mockClsService = { get: jest.fn().mockReturnValue('user-uuid-123') };

  //Configuracion inicial antes de cada prueba, creando un módulo de prueba con dependencias simuladas
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmpleadoBulkController],
      providers: [
        { provide: ConsultarEstadoCargaMasivaUseCase, useValue: mockConsultarUseCase },
        { provide: ValidarCargaMasivaUseCase, useValue: mockValidarUseCase },
        { provide: ConfirmarCargaMasivaUseCase, useValue: mockConfirmarUseCase },
        { provide: ClsService, useValue: mockClsService },
      ]
    }).compile();

    controller = module.get<EmpleadoBulkController>(EmpleadoBulkController);
  });

  afterEach(() => jest.clearAllMocks()); //Limpiar los mocks después de cada prueba

  describe('getBulkStatus (GET /api/rrhh/empleados/bulk/:jobId)', () => {
    it('Debe lanzar BadRequestException si no se proporciona jobId', async () => {
      //Assert: Se espera que la llamada al método getBulkStatus con un jobId vacío lance una excepción BadRequestException
      await expect(controller.getBulkStatus('')).rejects.toThrow(new BadRequestException('El parámetro jobId es obligatorio.'));
      expect(mockConsultarUseCase.execute).not.toHaveBeenCalled();
    });

    it('Debe retornar el estado del job y timestamp correctamente', async () => {
      //Arrange
      const mockStatus = {
        id: 'job-123',
        estado: 'PROCESANDO',
        total_registros: 10,
        procesados: 5,
        fallidos: 0
      };

      //Act
      mockConsultarUseCase.execute.mockResolvedValue(mockStatus);
      const result = await controller.getBulkStatus('job-123');

      //Assert
      expect(mockConsultarUseCase.execute).toHaveBeenCalledWith('job-123', 'user-uuid-123');
      expect(result.data).toEqual(mockStatus);
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('validateBulk (POST /api/rrhh/empleados/bulk/validar)', () => {
    it('Debe lanzar BadRequestException si la petición no es multipart/form-data', async () => {
      //Arrange: Simular una solicitud que no es multipart/form-data
      const mockRequest = {isMultipart: jest.fn().mockReturnValue(false) } as unknown as FastifyRequest;

      //Act & Assert: Se espera que la llamada al método validateBulk lance una excepción BadRequestException
      await expect(controller.validateBulk(mockRequest)).rejects.toThrow(new BadRequestException('El formato de la petición debe ser multipart/form-data.'));
      expect(mockValidarUseCase.execute).not.toHaveBeenCalled();
    });


    it('Debe lanzar BadRequestException si no se adjunta ningún archivo', async () => {
      //Arrange: Simular una solicitud multipart/form-data sin archivo adjunto
      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(true),
        file: jest.fn().mockResolvedValue(null)
      } as unknown as FastifyRequest;

      //Act & Assert: Se espera que la llamada al método validateBulk lance una excepción BadRequestException
      await expect(controller.validateBulk(mockRequest)).rejects.toThrow(new BadRequestException('No se encontró ningún archivo en la petición.'));
      expect(mockValidarUseCase.execute).not.toHaveBeenCalled();
    });


    it('Debe lanzar BadRequestException si el archivo no tiene extensión .csv ni .xlsx', async () => {
      //Arrange: Simular una solicitud multipart/form-data con un archivo de extensión no permitida
      const mockFileData = {
        filename: 'documento_no_permitido.pdf',
        mimetype: 'application/pdf',
        file: {}
      };

      //Simular una solicitud multipart/form-data con un archivo de extensión no permitida
      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(true),
        file: jest.fn().mockResolvedValue(mockFileData),
      } as unknown as FastifyRequest;

      //Act & Assert: Se espera que la llamada al método validateBulk lance una excepción BadRequestException
      await expect(controller.validateBulk(mockRequest)).rejects.toThrow(new BadRequestException('El archivo debe ser de formato Excel (.xlsx) o CSV (.csv).'));
      expect(mockValidarUseCase.execute).not.toHaveBeenCalled();
    });


    it('Debe ejecutar la pre-validación correctamente y retornar el reporte 200 OK', async () => {
      //Arrange: Simular una solicitud multipart/form-data con un archivo CSV válido
      const mockFileData = {
        filename: 'empleados.csv',
        mimetype: 'text/csv',
        file: {}
      };

      //Simular una solicitud multipart/form-data con un archivo CSV válido
      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(true),
        file: jest.fn().mockResolvedValue(mockFileData)
      } as unknown as FastifyRequest;

      //Simular un reporte de pre-validación que será retornado por el caso de uso ValidarCargaMasivaUseCase
      const mockReporte = {
        total_filas: 2,
        filas_validas: 2,
        filas_invalidas: 0,
        errores_detalle: [],
        filas_validas_data: [],
      };

      //Act: Simular la ejecución del caso de uso ValidarCargaMasivaUseCase para retornar el reporte de pre-validación
      mockValidarUseCase.execute.mockResolvedValue(mockReporte);

      const result = await controller.validateBulk(mockRequest);

      expect(mockValidarUseCase.execute).toHaveBeenCalledWith(
        'empleados.csv',
        'text/csv',
        mockFileData.file
      );
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockReporte);
      expect(result).toHaveProperty('timestamp');
    });


    it('Debe procesar archivos Excel sin lanzar excepciones de formato', async () => {
      //Arrange: Simular una solicitud multipart/form-data con un archivo Excel válido
      const mockFileData = {
        filename: 'nomina.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        file: {}
      };

      //Simular una solicitud multipart/form-data con un archivo Excel válido
      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(true),
        file: jest.fn().mockResolvedValue(mockFileData)
      } as unknown as FastifyRequest;

      //Simular un reporte de pre-validación que será retornado por el caso de uso ValidarCargaMasivaUseCase
      mockValidarUseCase.execute.mockResolvedValue({ total_filas: 5, filas_validas: 5 });

      //Act: Ejecutar el método validateBulk con el archivo Excel simulado
      const result = await controller.validateBulk(mockRequest);

      //Assert: Verificar que el caso de uso ValidarCargaMasivaUseCase fue llamado correctamente y que la respuesta es 200 OK
      expect(mockValidarUseCase.execute).toHaveBeenCalledWith(
        'nomina.xlsx',
        mockFileData.mimetype,
        mockFileData.file
      );
      expect(result.status).toBe(HttpStatus.OK);
    });
  });


  describe('confirmBulk (POST /api/rrhh/empleados/bulk/confirmar)', () => {
    it('Debe aceptar el payload de filas confirmadas, fijar status 202 ACCEPTED y retornar jobId', async () => {
      //Arrange: Simular un payload válido de filas confirmadas y un FastifyReply simulado
      const mockReply = {status: jest.fn().mockReturnThis()} as unknown as FastifyReply;

      //Simular un payload válido de filas confirmadas
      const mockPayload = {
        total_filas: 2,
        filas_validas: 2,
        filas_invalidas: 0,
        errores_detalle: [],
        filas_validas_data: [{
          tipo_documento: 'DNI' as const,
          nro_documento: '70998877',
          nombre: 'Roberto',
          apellido: 'Flores Gomez',
          asig_familiar: false,
          cargo: 'Analista',
          area: 'Recursos Humanos'
        }]
      };

      mockConfirmarUseCase.execute.mockResolvedValue({ jobId: 'job-confirm-999' });

      //Act: Ejecutar el método confirmBulk con el payload simulado y el FastifyReply simulado
      const result = await controller.confirmBulk(mockPayload, mockReply);

      //Assert: Verificar que el caso de uso ConfirmarCargaMasivaUseCase fue llamado correctamente y que la respuesta es 202 ACCEPTED con jobId
      expect(mockConfirmarUseCase.execute).toHaveBeenCalledWith('user-uuid-123', mockPayload);
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
      expect(result.jobId).toBe('job-confirm-999');
      expect(result.status).toBe(HttpStatus.ACCEPTED);
      expect(result).toHaveProperty('timestamp');
    });


    it('Debe propagar BadRequestException si el caso de uso la arroja por payload vacío o inválido', async () => {
      //Arrange: Simular un payload vacío y un FastifyReply simulado
      const mockReply = {status: jest.fn().mockReturnThis() } as unknown as FastifyReply;

      //Simular que el caso de uso ConfirmarCargaMasivaUseCase arroja una BadRequestException por payload vacío
      mockConfirmarUseCase.execute.mockRejectedValue(new BadRequestException('No hay filas válidas proporcionadas para procesar.'));

      //Act & Assert: Se espera que la llamada al método confirmBulk lance una excepción BadRequestException
      await expect(controller.confirmBulk({}, mockReply)).rejects.toThrow(new BadRequestException('No hay filas válidas proporcionadas para procesar.'));
    });
  });

  
  describe('descargarPlantilla (GET /api/rrhh/empleados/bulk/plantilla)', () => {
    it('Debe enviar las cabeceras de adjunto CSV correctamente', () => {
      //Arrange: Simular un FastifyReply para capturar las cabeceras y el contenido enviado
      const mockReply = { header: jest.fn().mockReturnThis(), send: jest.fn() } as unknown as FastifyReply;

      //Act: Ejecutar el método descargarPlantilla con el FastifyReply simulado
      controller.descargarPlantilla(mockReply);

      //Assert: Verificar que las cabeceras de respuesta sean correctas para un archivo CSV adjunto
      expect(mockReply.header).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=UTF-8');
      expect(mockReply.header).toHaveBeenCalledWith(
        'content-disposition',
        'attachment; filename="plantilla_carga_masiva_empleados.csv"'
      );

      expect(mockReply.send).toHaveBeenCalledWith(expect.stringContaining('tipo_documento,nro_documento,nombre,apellido,area,cargo,jornada,fecha_nacimiento,asig_familiar'));
    });
  });
});