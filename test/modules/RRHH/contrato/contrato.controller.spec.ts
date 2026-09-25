import { Test, TestingModule } from '@nestjs/testing';
import { 
  BadRequestException, 
  NotFoundException, 
  InternalServerErrorException 
} from '@nestjs/common';
import { ContratoController } from '@/modules/RRHH/contrato/controller/contrato.controller';
import { CrearContratoUseCase } from '@/modules/RRHH/contrato/use-cases/crearContrato.useCase';
import { EditarContratoUseCase } from '@/modules/RRHH/contrato/use-cases/editarContrato.useCase';
import { RenovarContratoUseCase } from '@/modules/RRHH/contrato/use-cases/renovarContrato.useCase';
import { AnularContratoUseCase } from '@/modules/RRHH/contrato/use-cases/anularContrato.useCase';
import { ListarContratoUseCase } from '@/modules/RRHH/contrato/use-cases/listarContrato.useCase';
import { SubirContratoPdfUseCase } from '@/modules/RRHH/contrato/use-cases/subirContratoPdf.useCase';
import { CrearContratoDto, EditarContratoDto, RenovarContratoDto, ListarContratosQueryDto } from '@jyp/shared-contracts';
import type { FastifyRequest, FastifyReply } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    existsSync: jest.fn(),
    createReadStream: jest.fn(),
  };
});

jest.mock('path', () => {
  const actualPath = jest.requireActual('path');
  return {
    ...actualPath,
    basename: jest.fn((p) => actualPath.basename(p)),
    join: jest.fn((...args) => actualPath.join(...args)),
  };
});

describe('ContratoController - Cobertura Exhaustiva de Capa HTTP y Seguridad', () => {
  let controller: ContratoController;
  let crearContratoUseCase: CrearContratoUseCase;
  let editarContratoUseCase: EditarContratoUseCase;
  let renovarContratoUseCase: RenovarContratoUseCase;
  let anularContratoUseCase: AnularContratoUseCase;
  let listarContratoUseCase: ListarContratoUseCase;
  let subirContratoPdfUseCase: SubirContratoPdfUseCase;

  const mockContratoId = '018f4a3c-7b2a-7123-8901-0123456789ad';
  const mockEmpleadoId = '018f4a3c-7b2a-7123-8901-0123456789ab';
  const mockEstadoId = '018f4a3c-7b2a-7123-8901-0123456789ac';

  const mockCrearUseCase = { execute: jest.fn() };
  const mockEditarUseCase = { execute: jest.fn() };
  const mockRenovarUseCase = { execute: jest.fn() };
  const mockAnularUseCase = { execute: jest.fn() };
  const mockListarUseCase = { execute: jest.fn() };
  const mockSubirPdfUseCase = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContratoController],
      providers: [
        { provide: CrearContratoUseCase, useValue: mockCrearUseCase },
        { provide: EditarContratoUseCase, useValue: mockEditarUseCase },
        { provide: RenovarContratoUseCase, useValue: mockRenovarUseCase },
        { provide: AnularContratoUseCase, useValue: mockAnularUseCase },
        { provide: ListarContratoUseCase, useValue: mockListarUseCase },
        { provide: SubirContratoPdfUseCase, useValue: mockSubirPdfUseCase },
      ],
    }).compile();

    controller = module.get<ContratoController>(ContratoController);
    crearContratoUseCase = module.get<CrearContratoUseCase>(CrearContratoUseCase);
    editarContratoUseCase = module.get<EditarContratoUseCase>(EditarContratoUseCase);
    renovarContratoUseCase = module.get<RenovarContratoUseCase>(RenovarContratoUseCase);
    anularContratoUseCase = module.get<AnularContratoUseCase>(AnularContratoUseCase);
    listarContratoUseCase = module.get<ListarContratoUseCase>(ListarContratoUseCase);
    subirContratoPdfUseCase = module.get<SubirContratoPdfUseCase>(SubirContratoPdfUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  describe('POST /api/contrato - crearContrato', () => {
    const payload: CrearContratoDto = {
      empleado_id: mockEmpleadoId,
      id_estado: mockEstadoId,
      tipo_modalidad: 'PLAZO_FIJO',
      fecha_inicio: new Date('2026-09-01'),
      fecha_fin: new Date('2027-02-28'),
      observacion: 'Contrato inicial',
    };

    it('Happy Path: Debe procesar exitosamente la creación de un contrato', async () => {
      const mockRespuesta = { id: mockContratoId, url: null, ...payload };
      mockCrearUseCase.execute.mockResolvedValue(mockRespuesta);

      const result = await controller.crearContrato(payload);

      expect(crearContratoUseCase.execute).toHaveBeenCalledWith(payload);
      expect(result).toEqual(mockRespuesta);
    });

    it('Excepción: Debe propagar NotFoundException si el empleado o estado no existen', async () => {
      mockCrearUseCase.execute.mockRejectedValue(new NotFoundException('Empleado no encontrado'));
      await expect(controller.crearContrato(payload)).rejects.toThrow(NotFoundException);
    });

    it('Excepción: Debe propagar InternalServerErrorException en fallo crítico de base de datos', async () => {
      mockCrearUseCase.execute.mockRejectedValue(new InternalServerErrorException('Error DB'));
      await expect(controller.crearContrato(payload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('PATCH /api/contrato/:id/actualizar - actualizarContrato', () => {
    const payload: EditarContratoDto = {
      tipo_modalidad: 'NECESIDAD_MERCADO',
      observacion: 'Actualización por requerimiento operativo',
    };

    it('Happy Path: Debe actualizar los datos del contrato borrador (sin PDF sellado)', async () => {
      const mockRespuesta = { id: mockContratoId, url: null, ...payload };
      mockEditarUseCase.execute.mockResolvedValue(mockRespuesta);

      const result = await controller.actualizarContrato(mockContratoId, payload);

      expect(editarContratoUseCase.execute).toHaveBeenCalledWith(mockContratoId, payload);
      expect(result).toEqual(mockRespuesta);
    });

    it('Regla de Negocio: Debe rechazar la edición si el contrato ya se encuentra sellado', async () => {
      mockEditarUseCase.execute.mockRejectedValue(new BadRequestException('El contrato ha sido sellado.'));
      await expect(controller.actualizarContrato(mockContratoId, payload)).rejects.toThrow(BadRequestException);
    });

    it('Excepción: Debe retornar NotFoundException si el contrato no existe', async () => {
      mockEditarUseCase.execute.mockRejectedValue(new NotFoundException('Contrato no encontrado.'));
      await expect(controller.actualizarContrato(mockContratoId, payload)).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /api/contrato/:id/renovar - renovarContrato', () => {
    const payload: RenovarContratoDto = {
      id_estado: mockEstadoId,
      fecha_inicio: new Date('2026-10-01'),
      fecha_fin: new Date('2027-03-31'),
      tipo_modalidad: 'INCREMENTO_ACTIVIDAD',
      observacion: 'Renovación semestral',
    };

    it('Happy Path: Debe renovar el contrato generando un nuevo registro', async () => {
      const mockRespuesta = { id: 'nuevo-id', empleado_id: mockEmpleadoId, ...payload };
      mockRenovarUseCase.execute.mockResolvedValue(mockRespuesta);

      const result = await controller.renovarContrato(mockContratoId, payload);

      expect(renovarContratoUseCase.execute).toHaveBeenCalledWith(mockContratoId, payload);
      expect(result).toEqual(mockRespuesta);
    });

    it('Regla de Negocio: Debe fallar si se intenta renovar el contrato de un empleado cesado', async () => {
      mockRenovarUseCase.execute.mockRejectedValue(new BadRequestException('Empleado cesado.'));
      await expect(controller.renovarContrato(mockContratoId, payload)).rejects.toThrow(BadRequestException);
    });

    it('Excepción: Debe lanzar NotFoundException si el contrato original no existe', async () => {
      mockRenovarUseCase.execute.mockRejectedValue(new NotFoundException('No encontrado.'));
      await expect(controller.renovarContrato(mockContratoId, payload)).rejects.toThrow(NotFoundException);
    });
  });

  describe('DELETE /api/contrato/:id/anular - anularContrato', () => {
    it('Happy Path: Debe anular lógicamente un contrato devolviendo soft-delete', async () => {
      const mockRespuesta = { id: mockContratoId, deleted_at: new Date() };
      mockAnularUseCase.execute.mockResolvedValue(mockRespuesta);

      const result = await controller.anularContrato(mockContratoId);

      expect(anularContratoUseCase.execute).toHaveBeenCalledWith(mockContratoId);
      expect(result).toEqual(mockRespuesta);
    });

    it('Excepción: Debe retornar NotFoundException si el contrato no existe', async () => {
      mockAnularUseCase.execute.mockRejectedValue(new NotFoundException('No encontrado.'));
      await expect(controller.anularContrato(mockContratoId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /api/contrato - listarContratos', () => {
    it('Happy Path: Debe listar los contratos con filtros y paginación', async () => {
      const query: ListarContratosQueryDto = { page: 1, limit: 10, por_vencer_dias: 30 };
      const mockRespuesta = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };

      mockListarUseCase.execute.mockResolvedValue(mockRespuesta);

      const result = await controller.listarContratos(query);

      expect(listarContratoUseCase.execute).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockRespuesta);
    });
  });

  describe('GET /api/contrato/empleado/:empleadoId - obtenerHistorialEmpleado', () => {
    it('Happy Path: Debe obtener el historial de contratos e información consolidada del empleado', async () => {
      const query: ListarContratosQueryDto = { page: 1, limit: 10 };
      const mockRespuesta = {
        data: [
          {
            id: mockContratoId,
            empleado_id: mockEmpleadoId,
            colaborador: 'Juan Pérez',
            nro_documento: '70654321',
            area: 'Sistemas',
            cargo: 'Desarrollador',
            estado: 'VIGENTE',
            tipo_modalidad: 'PLAZO_FIJO',
            fecha_inicio: new Date('2026-01-01'),
            fecha_fin: new Date('2026-12-31'),
            dias_restantes: 98,
            tiene_pdf: false,
            nombre_archivo: null,
          },
        ],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };

      mockListarUseCase.execute.mockResolvedValue(mockRespuesta);

      const result = await controller.obtenerHistorialEmpleado(mockEmpleadoId, query);

      expect(listarContratoUseCase.execute).toHaveBeenCalledWith({
        ...query,
        empleado_id: mockEmpleadoId,
      });
      expect(result).toEqual(mockRespuesta);
    });

    it('Excepción: Debe retornar NotFoundException si el empleado no existe en la base de datos', async () => {
      const query: ListarContratosQueryDto = { page: 1, limit: 10 };
      mockListarUseCase.execute.mockRejectedValue(new NotFoundException('Empleado no encontrado'));

      await expect(controller.obtenerHistorialEmpleado(mockEmpleadoId, query)).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /api/contrato/:id/subir-pdf - subirContratoPdf', () => {
    it('Happy Path: Debe recibir un archivo mediante stream multipart y delegar al UseCase', async () => {
      const mockFileData = {
        filename: 'contrato_firmado.pdf',
        mimetype: 'application/pdf',
        file: Readable.from(['contenido-pdf']),
      };

      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(true),
        file: jest.fn().mockResolvedValue(mockFileData),
      } as unknown as FastifyRequest;

      const mockRespuestaUseCase = {
        message: 'Documento subido y vinculado correctamente.',
        url: '/archivos/contratos/1771100000000-018f4a3c.pdf',
      };

      mockSubirPdfUseCase.execute.mockResolvedValue(mockRespuestaUseCase);

      const result = await controller.subirContratoPdf(mockContratoId, mockRequest);

      expect(mockRequest.isMultipart).toHaveBeenCalled();
      expect(mockRequest.file).toHaveBeenCalled();
      expect(subirContratoPdfUseCase.execute).toHaveBeenCalledWith(mockContratoId, mockFileData);
      expect(result).toEqual(mockRespuestaUseCase);
    });

    it('Validación HTTP: Debe rechazar peticiones que no sean multipart/form-data', async () => {
      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(false),
      } as unknown as FastifyRequest;

      await expect(controller.subirContratoPdf(mockContratoId, mockRequest)).rejects.toThrow(BadRequestException);
      expect(subirContratoPdfUseCase.execute).not.toHaveBeenCalled();
    });

    it('Validación HTTP: Debe rechazar la solicitud si no hay archivo adjunto', async () => {
      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(true),
        file: jest.fn().mockResolvedValue(null),
      } as unknown as FastifyRequest;

      await expect(controller.subirContratoPdf(mockContratoId, mockRequest)).rejects.toThrow(BadRequestException);
      expect(subirContratoPdfUseCase.execute).not.toHaveBeenCalled();
    });

    it('Regla de Negocio: Debe propagar BadRequestException si el contrato ya poseía un PDF', async () => {
      const mockFileData = { filename: 'otro.pdf' };
      const mockRequest = {
        isMultipart: jest.fn().mockReturnValue(true),
        file: jest.fn().mockResolvedValue(mockFileData),
      } as unknown as FastifyRequest;

      mockSubirPdfUseCase.execute.mockRejectedValue(new BadRequestException('Ya tiene PDF.'));

      await expect(controller.subirContratoPdf(mockContratoId, mockRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /api/contrato/descargar/:filename - descargarContratoPdf', () => {
    let mockResponse: Partial<FastifyReply>;
    let mockSend: jest.Mock;
    let mockType: jest.Mock;

    beforeEach(() => {
      mockSend = jest.fn();
      mockType = jest.fn().mockReturnThis();
      mockResponse = {
        type: mockType,
        send: mockSend,
      };
    });

    it('Happy Path: Debe transmitir el stream del archivo PDF con application/pdf', () => {
      const mockFileName = '1771100000000-contrato.pdf';
      const mockStream = new Readable();

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createReadStream as jest.Mock).mockReturnValue(mockStream as any);

      controller.descargarContratoPdf(mockFileName, mockResponse as FastifyReply);

      expect(path.basename).toHaveBeenCalledWith(mockFileName);
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.createReadStream).toHaveBeenCalled();
      expect(mockType).toHaveBeenCalledWith('application/pdf');
      expect(mockSend).toHaveBeenCalledWith(mockStream);
    });

    it('Seguridad / Path Traversal: Debe sanitizar el nombre del archivo usando path.basename', () => {
      const maliciousPath = '../../../../etc/passwd';
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => {
        controller.descargarContratoPdf(maliciousPath, mockResponse as FastifyReply);
      }).toThrow(BadRequestException);

      expect(path.basename).toHaveBeenCalledWith(maliciousPath);
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('Excepción: Debe lanzar BadRequestException si el archivo PDF solicitado no existe', () => {
      const mockFileName = 'invalido.pdf';
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => {
        controller.descargarContratoPdf(mockFileName, mockResponse as FastifyReply);
      }).toThrow(new BadRequestException('El archivo solicitado no existe.'));

      expect(mockType).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});