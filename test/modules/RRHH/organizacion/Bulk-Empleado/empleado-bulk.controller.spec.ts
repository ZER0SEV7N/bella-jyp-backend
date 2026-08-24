import { Test, TestingModule } from '@nestjs/testing';
import { EmpleadoBulkController } from '@/modules/RRHH/organizacion/controller/empleado-bulk.controller';
import { ConsultarEstadoCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase';
import { ValidarCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/validarCargaMasiva.useCase';
import { ConfirmarCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/confirmarCargaMasiva.useCase';
import { ClsService } from 'nestjs-cls';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';

describe('EmpleadoBulkController - Pruebas Unitarias de Endpoints HTTP', () => {
  let controller: EmpleadoBulkController;

  const mockConsultarUseCase = { execute: jest.fn() };
  const mockValidarUseCase = { execute: jest.fn() };
  const mockConfirmarUseCase = { execute: jest.fn() };
  const mockClsService = { get: jest.fn().mockReturnValue('user-uuid-123') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmpleadoBulkController],
      providers: [
        { provide: ConsultarEstadoCargaMasivaUseCase, useValue: mockConsultarUseCase },
        { provide: ValidarCargaMasivaUseCase, useValue: mockValidarUseCase },
        { provide: ConfirmarCargaMasivaUseCase, useValue: mockConfirmarUseCase },
        { provide: ClsService, useValue: mockClsService },
      ],
    }).compile();

    controller = module.get<EmpleadoBulkController>(EmpleadoBulkController);
    jest.clearAllMocks();
  });

  describe('getBulkStatus (GET /api/rrhh/empleados/bulk/:jobId)', () => {
    it('Debe lanzar BadRequestException si no se proporciona jobId', async () => {
      await expect(controller.getBulkStatus('')).rejects.toThrow(
        new BadRequestException('El parámetro jobId es obligatorio.'),
      );
      expect(mockConsultarUseCase.execute).not.toHaveBeenCalled();
    });

    it('Happy Path: Debe retornar el estado del job y timestamp correctamente', async () => {
      const mockStatus = {
        id: 'job-123',
        estado: 'PROCESANDO',
        total_registros: 10,
        procesados: 5,
        fallidos: 0,
      };
      mockConsultarUseCase.execute.mockResolvedValue(mockStatus);

      const result = await controller.getBulkStatus('job-123');

      expect(mockConsultarUseCase.execute).toHaveBeenCalledWith('job-123', 'user-uuid-123');
      expect(result.data).toEqual(mockStatus);
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('validateBulk (POST /api/rrhh/empleados/bulk/validar)', () => {
    it('Excepción: Debe lanzar BadRequestException si la petición no es multipart/form-data', async () => {
      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(false),
      } as unknown as FastifyRequest;

      await expect(controller.validateBulk(mockRequest)).rejects.toThrow(
        new BadRequestException('El formato de la petición debe ser multipart/form-data.'),
      );
      expect(mockValidarUseCase.execute).not.toHaveBeenCalled();
    });

    it('Excepción: Debe lanzar BadRequestException si no se adjunta ningún archivo', async () => {
      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(true),
        file: jest.fn().mockResolvedValue(null),
      } as unknown as FastifyRequest;

      await expect(controller.validateBulk(mockRequest)).rejects.toThrow(
        new BadRequestException('No se encontró ningún archivo en la petición.'),
      );
      expect(mockValidarUseCase.execute).not.toHaveBeenCalled();
    });

    it('Excepción: Debe lanzar BadRequestException si el archivo no tiene extensión .csv ni .xlsx', async () => {
      const mockFileData = {
        filename: 'documento_no_permitido.pdf',
        mimetype: 'application/pdf',
        file: {},
      };

      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(true),
        file: jest.fn().mockResolvedValue(mockFileData),
      } as unknown as FastifyRequest;

      await expect(controller.validateBulk(mockRequest)).rejects.toThrow(
        new BadRequestException('El archivo debe ser de formato Excel (.xlsx) o CSV (.csv).'),
      );
      expect(mockValidarUseCase.execute).not.toHaveBeenCalled();
    });

    it('Happy Path (.csv): Debe ejecutar la pre-validación correctamente y retornar el reporte 200 OK', async () => {
      const mockFileData = {
        filename: 'empleados.csv',
        mimetype: 'text/csv',
        file: {},
      };

      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(true),
        file: jest.fn().mockResolvedValue(mockFileData),
      } as unknown as FastifyRequest;

      const mockReporte = {
        total_filas: 2,
        filas_validas: 2,
        filas_invalidas: 0,
        errores_detalle: [],
        filas_validas_data: [],
      };

      mockValidarUseCase.execute.mockResolvedValue(mockReporte);

      const result = await controller.validateBulk(mockRequest);

      expect(mockValidarUseCase.execute).toHaveBeenCalledWith(
        'empleados.csv',
        'text/csv',
        mockFileData.file,
      );
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockReporte);
      expect(result).toHaveProperty('timestamp');
    });

    it('Happy Path (.xlsx): Debe procesar archivos Excel sin lanzar excepciones de formato', async () => {
      const mockFileData = {
        filename: 'nomina.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        file: {},
      };

      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(true),
        file: jest.fn().mockResolvedValue(mockFileData),
      } as unknown as FastifyRequest;

      mockValidarUseCase.execute.mockResolvedValue({ total_filas: 5, filas_validas: 5 });

      const result = await controller.validateBulk(mockRequest);

      expect(mockValidarUseCase.execute).toHaveBeenCalledWith(
        'nomina.xlsx',
        mockFileData.mimetype,
        mockFileData.file,
      );
      expect(result.status).toBe(HttpStatus.OK);
    });
  });

  describe('confirmBulk (POST /api/rrhh/empleados/bulk/confirmar)', () => {
    it('Happy Path: Debe aceptar el payload de filas confirmadas, fijar status 202 ACCEPTED y retornar jobId', async () => {
      const mockReply = {
        status: jest.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      const mockPayload = {
        total_filas: 2,
        filas_validas: 2,
        filas_invalidas: 0,
        errores_detalle: [],
        filas_validas_data: [
          {
            tipo_documento: 'DNI' as const,
            nro_documento: '70998877',
            nombre: 'Roberto',
            apellido: 'Flores Gomez',
            asig_familiar: false,
            cargo: 'Analista',
            area: 'Recursos Humanos',
          },
        ],
      };

      mockConfirmarUseCase.execute.mockResolvedValue({ jobId: 'job-confirm-999' });

      const result = await controller.confirmBulk(mockPayload, mockReply);

      expect(mockConfirmarUseCase.execute).toHaveBeenCalledWith('user-uuid-123', mockPayload);
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
      expect(result.jobId).toBe('job-confirm-999');
      expect(result.status).toBe(HttpStatus.ACCEPTED);
      expect(result).toHaveProperty('timestamp');
    });

    it('Excepción: Debe propagar BadRequestException si el caso de uso la arroja por payload vacío o inválido', async () => {
      const mockReply = {
        status: jest.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      mockConfirmarUseCase.execute.mockRejectedValue(
        new BadRequestException('No hay filas válidas proporcionadas para procesar.'),
      );

      await expect(controller.confirmBulk({}, mockReply)).rejects.toThrow(
        new BadRequestException('No hay filas válidas proporcionadas para procesar.'),
      );
    });
  });

  describe('descargarPlantilla (GET /api/rrhh/empleados/bulk/plantilla)', () => {
    it('Happy Path: Debe enviar las cabeceras de adjunto CSV correctamente', () => {
      const mockReply = {
        header: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as FastifyReply;

      controller.descargarPlantilla(mockReply);

      expect(mockReply.header).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=UTF-8');
      expect(mockReply.header).toHaveBeenCalledWith(
        'content-disposition',
        'attachment; filename="plantilla_carga_masiva_empleados.csv"',
      );
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.stringContaining('tipo_documento,nro_documento,nombre,apellido,area,cargo,jornada,fecha_nacimiento,asig_familiar'),
      );
    });
  });
});