//test/modules/RRHH/contrato/contrato.controller.spec.ts
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
import { CrearContratoDto, EditarContratoDto, RenovarContratoDto } from '@jyp/shared-contracts';
import type { FastifyRequest, FastifyReply } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

//Mock del modulo nativo de Node.js 'fs' para simular la existencia de archivos y la creación de streams
jest.mock('fs', () => {
    const actualFs = jest.requireActual('fs');
    return {
        ...actualFs,
        existsSync: jest.fn(),
        createReadStream: jest.fn(),
    };
});

//Mock del modulo nativo de Node.js 'path' para simular la manipulación de rutas de archivos
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
                { provide: SubirContratoPdfUseCase, useValue: mockSubirPdfUseCase }
            ]
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
            observacion: 'Contrato inicial'
        };

        it('Happy Path: Debe procesar exitosamente la creación de un contrato', async () => {
            const mockRespuesta = {
                id: mockContratoId,
                url: null,
                ...payload,
            };

            mockCrearUseCase.execute.mockResolvedValue(mockRespuesta);

            const result = await controller.crearContrato(payload);

            expect(crearContratoUseCase.execute).toHaveBeenCalledWith(payload);
            expect(result).toEqual(mockRespuesta);
        });

        it('Excepción: Debe propagar NotFoundException si el empleado o estado no existen', async () => {
            mockCrearUseCase.execute.mockRejectedValue(new NotFoundException('Empleado no encontrado'));

            await expect(controller.crearContrato(payload)).rejects.toThrow(NotFoundException);
        });

        it('Excepción: Debe propagar InternalServerErrorException en caso de fallo crítico en base de datos', async () => {
            mockCrearUseCase.execute.mockRejectedValue(new InternalServerErrorException('Error al intentar registrar el contrato.'));

            await expect(controller.crearContrato(payload)).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('PATCH /api/contrato/:id/actualizar - actualizarContrato', () => {
        const payload: EditarContratoDto = {
            tipo_modalidad: 'NECESIDAD_MERCADO',
            observacion: 'Actualización por requerimiento operativo'
        };

        it('Happy Path: Debe actualizar los datos del contrato borrador (sin PDF sellado)', async () => {
            const mockRespuesta = {
                id: mockContratoId,
                url: null,
                ...payload,
            };

            mockEditarUseCase.execute.mockResolvedValue(mockRespuesta);

            const result = await controller.actualizarContrato(mockContratoId, payload);

            expect(editarContratoUseCase.execute).toHaveBeenCalledWith(mockContratoId, payload);
            expect(result).toEqual(mockRespuesta);
        });

        it('Regla de Negocio: Debe rechazar la edición si el contrato ya se encuentra sellado (BadRequestException)', async () => {
            mockEditarUseCase.execute.mockRejectedValue(new BadRequestException('El contrato ha sido sellado. No se puede editar porque ya cuenta con un documento físico adjunto.'));

            await expect(controller.actualizarContrato(mockContratoId, payload)).rejects.toThrow(BadRequestException);
        });

        it('Excepción: Debe retornar NotFoundException si el ID del contrato no existe o fue deshabilitado', async () => {
            mockEditarUseCase.execute.mockRejectedValue(new NotFoundException('El contrato especificado no existe o ha sido eliminado.'));

            await expect(controller.actualizarContrato(mockContratoId, payload)).rejects.toThrow(NotFoundException);
        });
    });

    describe('POST /api/contrato/:id/renovar - renovarContrato', () => {
        const payload: RenovarContratoDto = {
            id_estado: mockEstadoId,
            fecha_inicio: new Date('2026-10-01'),
            fecha_fin: new Date('2027-03-31'),
            tipo_modalidad: 'INCREMENTO_ACTIVIDAD',
            observacion: 'Renovación semestral'
        };

        it('Happy Path: Debe renovar el contrato generando un nuevo registro y marcando renovado=true en el previo', async () => {
            const nuevoContratoId = '018f4a3c-7b2a-7123-8901-999999999999';
            const mockRespuesta = {
                id: nuevoContratoId,
                empleado_id: mockEmpleadoId,
                renovado: false,
                ...payload,
            };

            mockRenovarUseCase.execute.mockResolvedValue(mockRespuesta);

            const result = await controller.renovarContrato(mockContratoId, payload);

            expect(renovarContratoUseCase.execute).toHaveBeenCalledWith(mockContratoId, payload);
            expect(result).toEqual(mockRespuesta);
        });

        it('Regla de Negocio: Debe fallar si se intenta renovar el contrato de un empleado cesado', async () => {
            mockRenovarUseCase.execute.mockRejectedValue(new BadRequestException('No se puede crear un contrato de renovación para un empleado cesado.'));

            await expect(controller.renovarContrato(mockContratoId, payload)).rejects.toThrow(BadRequestException);
        });

        it('Excepción: Debe lanzar NotFoundException si el contrato original no existe', async () => {
            mockRenovarUseCase.execute.mockRejectedValue(new NotFoundException('El contrato a renovar no fue encontrado.'));

            await expect(controller.renovarContrato(mockContratoId, payload)).rejects.toThrow(NotFoundException);
        });
    });

    describe('DELETE /api/contrato/:id/anular - anularContrato', () => {
        it('Happy Path: Debe anular lógicamente un contrato devolviendo el registro con deleted_at', async () => {
            const fechaAnulacion = new Date('2026-08-14T20:00:00.000Z');
            const mockRespuesta = {
                id: mockContratoId,
                deleted_at: fechaAnulacion,
            };
                
            mockAnularUseCase.execute.mockResolvedValue(mockRespuesta);

            const result = await controller.anularContrato(mockContratoId);

            expect(anularContratoUseCase.execute).toHaveBeenCalledWith(mockContratoId);
            expect(result).toEqual(mockRespuesta);
        });

        it('Excepción: Debe retornar NotFoundException si el contrato ya estaba anulado o no existe', async () => {
            mockAnularUseCase.execute.mockRejectedValue(new NotFoundException('Contrato no encontrado o ya eliminado.'));

            await expect(controller.anularContrato(mockContratoId)).rejects.toThrow(NotFoundException);
        });
    });

    describe('GET /api/contrato/empleado/:empleadoId - obtenerHistorialEmpleado', () => {
        it('Happy Path: Debe obtener el historial de contratos e información consolidada del empleado', async () => {
            const mockRespuesta = {
                empleado: 'Juan Pérez',
                documento: '70654321',
                contratos: [{
                    id: mockContratoId,
                    fecha_inicio: '2026-01-01',
                    estado_contrato: { nombre: 'ACTIVO' }
                }]
            };

            mockListarUseCase.execute.mockResolvedValue(mockRespuesta);

            const result = await controller.obtenerHistorialEmpleado(mockEmpleadoId);

            expect(listarContratoUseCase.execute).toHaveBeenCalledWith(mockEmpleadoId);
            expect(result).toEqual(mockRespuesta);
        });

        it('Excepción: Debe retornar NotFoundException si el empleado no existe en la base de datos', async () => {
            mockListarUseCase.execute.mockRejectedValue(new NotFoundException('Empleado no encontrado o eliminado de la db'));

            await expect(controller.obtenerHistorialEmpleado(mockEmpleadoId)).rejects.toThrow(NotFoundException);
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
                message: 'Documento subido y vinculado correctamente. El contrato ya no puede ser editado.',
                url: '/archivos/contratos/1771100000000-018f4a3c.pdf',
            };

            mockSubirPdfUseCase.execute.mockResolvedValue(mockRespuestaUseCase);

            const result = await controller.subirContratoPdf(mockContratoId, mockRequest);

            expect(mockRequest.isMultipart).toHaveBeenCalled();
            expect(mockRequest.file).toHaveBeenCalled();
            expect(subirContratoPdfUseCase.execute).toHaveBeenCalledWith(mockContratoId, mockFileData);
            expect(result).toEqual(mockRespuestaUseCase);
        });

        it('Vulnerabilidad / Validación HTTP: Debe rechazar peticiones que no sean multipart/form-data', async () => {
            const mockRequest = {
                isMultipart: jest.fn().mockReturnValue(false),
            } as unknown as FastifyRequest;

            await expect(controller.subirContratoPdf(mockContratoId, mockRequest)).rejects.toThrow(
                new BadRequestException('La petición debe ser multipart/form-data')
            );
            expect(subirContratoPdfUseCase.execute).not.toHaveBeenCalled();
        });

        it('Validación HTTP: Debe rechazar la solicitud si req.file() retorna null (sin archivo adjunto)', async () => {
            const mockRequest = {
                isMultipart: jest.fn().mockReturnValue(true),
                file: jest.fn().mockResolvedValue(null),
            } as unknown as FastifyRequest;

            await expect(controller.subirContratoPdf(mockContratoId, mockRequest)).rejects.toThrow(
                new BadRequestException('No se adjuntó ningún archivo en el campo "file"')
            );
            expect(subirContratoPdfUseCase.execute).not.toHaveBeenCalled();
            });

        it('Regla de Negocio: Debe propagar BadRequestException si el contrato ya poseía un PDF adjunto previo', async () => {
            const mockFileData = { filename: 'otro.pdf' };
            const mockRequest = {
                isMultipart: jest.fn().mockReturnValue(true),
                file: jest.fn().mockResolvedValue(mockFileData),
            } as unknown as FastifyRequest;

            mockSubirPdfUseCase.execute.mockRejectedValue(
                new BadRequestException('El contrato ya tiene un PDF asociado. No se puede subir otro.')
            );

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

        it('Happy Path: Debe transmitir el stream del archivo PDF con el tipo de contenido application/pdf', () => {
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

        it('Seguridad / Path Traversal: Debe sanitizar el nombre del archivo usando path.basename impidiendo accesos relativos', () => {
        const maliciousPath = '../../../../etc/passwd';
        
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        expect(() => {
            controller.descargarContratoPdf(maliciousPath, mockResponse as FastifyReply);
        }).toThrow(BadRequestException);

        expect(path.basename).toHaveBeenCalledWith(maliciousPath);
        expect(fs.existsSync).toHaveBeenCalled();
        });

        it('Excepción: Debe lanzar BadRequestException si el archivo PDF solicitado no existe físicamente en el servidor', () => {
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