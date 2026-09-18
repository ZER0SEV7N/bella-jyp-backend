import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { DerechohabienteController } from '@/modules/RRHH/organizacion/controllers/derechohabiente.controller';
import { RegistrarDerechohabienteUseCase } from '@/modules/RRHH/organizacion/use-cases/derechohabiente/registrarDerechohabiente.useCase';
import { SubirSustentoDerechohabienteUseCase } from '@/modules/RRHH/organizacion/use-cases/derechohabiente/subirSustento.useCase';
import { ListarDerechohabientesUseCase } from '@/modules/RRHH/organizacion/use-cases/derechohabiente/listarDerechohabientes.useCase';
import { EstadoDerechohabienteUseCase } from '@/modules/RRHH/organizacion/use-cases/derechohabiente/estadoDerechohabiente.useCase';
import type { RegistrarDerechohabienteDto } from '@jyp/shared-contracts';
import type { FastifyRequest } from 'fastify';

/**
 * Pruebas unitarias para DerechohabienteController.
 * Valida la delegación correcta de endpoints HTTP hacia los casos de uso,
 * la extracción y parseo de peticiones multipart en Fastify y la captura de excepciones.
 */
describe('DerechohabienteController - Cobertura HTTP y Casos de Uso', () => {
  let controller: DerechohabienteController;
  let registrarUseCase: RegistrarDerechohabienteUseCase;
  let subirSustentoUseCase: SubirSustentoDerechohabienteUseCase;
  let listarUseCase: ListarDerechohabientesUseCase;
  let estadoUseCase: EstadoDerechohabienteUseCase;

  const mockEmpleadoId = '018f4a7c-9999-7000-3333-000000000002';
  const mockDerechohabienteId = '018f4a7c-0000-7000-8000-000000000001';

  const mockRegistrarUseCase = { execute: jest.fn() };
  const mockSubirSustentoUseCase = { execute: jest.fn() };
  const mockListarUseCase = { listarPorEmpleado: jest.fn() };
  const mockEstadoUseCase = { desactivar: jest.fn(), reactivar: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DerechohabienteController],
      providers: [
        { provide: RegistrarDerechohabienteUseCase, useValue: mockRegistrarUseCase },
        { provide: SubirSustentoDerechohabienteUseCase, useValue: mockSubirSustentoUseCase },
        { provide: ListarDerechohabientesUseCase, useValue: mockListarUseCase },
        { provide: EstadoDerechohabienteUseCase, useValue: mockEstadoUseCase },
      ],
    }).compile();

    controller = module.get<DerechohabienteController>(DerechohabienteController);
    registrarUseCase = module.get<RegistrarDerechohabienteUseCase>(RegistrarDerechohabienteUseCase);
    subirSustentoUseCase = module.get<SubirSustentoDerechohabienteUseCase>(SubirSustentoDerechohabienteUseCase);
    listarUseCase = module.get<ListarDerechohabientesUseCase>(ListarDerechohabientesUseCase);
    estadoUseCase = module.get<EstadoDerechohabienteUseCase>(EstadoDerechohabienteUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  // =========================================================================
  // 1. POST /api/rrhh/derechohabiente/registrar - registrar
  // =========================================================================
  describe('POST /api/rrhh/derechohabiente/registrar - registrar', () => {
    const payload: RegistrarDerechohabienteDto = {
      empleado_id: mockEmpleadoId,
      documento_id: '018f4a7c-2222-7000-b000-000000000001',
      nro_documento: '91223344',
      nombres: 'Mateo',
      apellidos: 'Ramírez Vargas',
      vinculo: 'HIJO_MENOR',
      estado_civil: 'SOLTERO',
      sexo: 'MASCULINO',
      fecha_nacimiento: '2020-05-15',
    };

    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe delegar el registro al caso de uso y retornar el derechohabiente creado', async () => {
        // Arrange
        const mockResponse = { id: mockDerechohabienteId, ...payload, activo: true };
        mockRegistrarUseCase.execute.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.registrarDerechohabiente(payload);

        // Assert
        expect(registrarUseCase.execute).toHaveBeenCalledWith(payload);
        expect(result).toEqual(mockResponse);
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe propagar ConflictException si el documento ya se encuentra registrado para el titular', async () => {
        // Arrange
        mockRegistrarUseCase.execute.mockRejectedValue(
          new ConflictException({
            title: 'Derechohabiente Duplicado',
            detail: 'El familiar ya se encuentra registrado.',
          }),
        );

        // Act & Assert
        await expect(controller.registrarDerechohabiente(payload)).rejects.toThrow(ConflictException);
      });

      it('Debe propagar NotFoundException si el colaborador titular no existe', async () => {
        // Arrange
        mockRegistrarUseCase.execute.mockRejectedValue(
          new NotFoundException({
            title: 'Colaborador Titular Inválido',
            detail: 'El colaborador titular no existe o está inactivo.',
          }),
        );

        // Act & Assert
        await expect(controller.registrarDerechohabiente(payload)).rejects.toThrow(NotFoundException);
      });
    });
  });

  // =========================================================================
  // 2. POST /api/rrhh/derechohabiente/sustento/subir - subirSustento
  // =========================================================================
  describe('POST /api/rrhh/derechohabiente/sustento/subir - subirSustento', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe procesar la petición multipart de Fastify, parsear los campos y delegar la subida', async () => {
        // Arrange
        const mockFileData = {
          filename: 'partida_nacimiento.pdf',
          mimetype: 'application/pdf',
          file: {},
          fields: {
            derechohabiente_id: { value: mockDerechohabienteId },
            tipo_documento: { value: 'PARTIDA_NACIMIENTO' },
            fecha_emision: { value: '2020-06-01' },
          },
        };

        const mockRequest = {
          file: jest.fn().mockResolvedValue(mockFileData),
        } as unknown as FastifyRequest;

        const mockCreatedSustento = {
          id: 'sustento-uuid-1',
          derechohabiente_id: mockDerechohabienteId,
          tipo_documento: 'PARTIDA_NACIMIENTO',
          nombre_archivo: 'partida_nacimiento.pdf',
          archivo_url: '/archivos/derechohabientes/doc.pdf',
          vigente: true,
        };

        mockSubirSustentoUseCase.execute.mockResolvedValue(mockCreatedSustento);

        // Act
        const result = await controller.subirSustento(mockRequest);

        // Assert
        expect(mockRequest.file).toHaveBeenCalled();
        expect(subirSustentoUseCase.execute).toHaveBeenCalledWith(
          {
            derechohabiente_id: mockDerechohabienteId,
            tipo_documento: 'PARTIDA_NACIMIENTO',
            fecha_emision: '2020-06-01',
          },
          mockFileData,
        );
        expect(result).toEqual(mockCreatedSustento);
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe lanzar BadRequestException si no se adjunta ningún archivo en la solicitud', async () => {
        // Arrange: Simular que req.file() no devuelve archivo (null)
        const mockRequestSinArchivo = {
          file: jest.fn().mockResolvedValue(null),
        } as unknown as FastifyRequest;

        // Act & Assert
        await expect(controller.subirSustento(mockRequestSinArchivo)).rejects.toThrow(
          BadRequestException,
        );
        expect(subirSustentoUseCase.execute).not.toHaveBeenCalled();
      });

      it('Debe lanzar error de validación Zod si faltan campos obligatorios en el formulario multipart', async () => {
        // Arrange: Falta tipo_documento en los fields
        const mockFileDataIncompleto = {
          filename: 'doc.pdf',
          mimetype: 'application/pdf',
          file: {},
          fields: {
            derechohabiente_id: { value: mockDerechohabienteId },
          },
        };

        const mockRequest = {
          file: jest.fn().mockResolvedValue(mockFileDataIncompleto),
        } as unknown as FastifyRequest;

        // Act & Assert: SubirSustentoDerechohabienteSchema debe rechazar por schema inválido
        await expect(controller.subirSustento(mockRequest)).rejects.toThrow();
        expect(subirSustentoUseCase.execute).not.toHaveBeenCalled();
      });

      it('Debe propagar NotFoundException si el caso de uso no encuentra al familiar', async () => {
        // Arrange
        const mockFileData = {
          filename: 'partida.pdf',
          mimetype: 'application/pdf',
          file: {},
          fields: {
            derechohabiente_id: { value: mockDerechohabienteId },
            tipo_documento: { value: 'PARTIDA_NACIMIENTO' },
          },
        };

        const mockRequest = {
          file: jest.fn().mockResolvedValue(mockFileData),
        } as unknown as FastifyRequest;

        mockSubirSustentoUseCase.execute.mockRejectedValue(
          new NotFoundException({
            title: 'Derechohabiente no encontrado',
            detail: 'El familiar especificado no existe.',
          }),
        );

        // Act & Assert
        await expect(controller.subirSustento(mockRequest)).rejects.toThrow(NotFoundException);
      });
    });
  });

  // =========================================================================
  // 3. GET /api/rrhh/derechohabiente/empleado/:empleadoId - listarPorEmpleado
  // =========================================================================
  describe('GET /api/rrhh/derechohabiente/empleado/:empleadoId - listarPorEmpleado', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe delegar la consulta de familiares asociados al titular al caso de uso', async () => {
        // Arrange
        const mockLista = [
          {
            id: mockDerechohabienteId,
            empleado_id: mockEmpleadoId,
            nombres: 'Mateo',
            apellidos: 'Ramírez Vargas',
            vinculo: 'HIJO_MENOR',
            documentos: [],
          },
        ];
        mockListarUseCase.listarPorEmpleado.mockResolvedValue(mockLista);

        // Act
        const result = await controller.listarPorEmpleado(mockEmpleadoId);

        // Assert
        expect(listarUseCase.listarPorEmpleado).toHaveBeenCalledWith(mockEmpleadoId);
        expect(result).toEqual(mockLista);
      });
    });
  });

  // =========================================================================
  // 4. DELETE /api/rrhh/derechohabiente/:id/desactivar - desactivar
  // =========================================================================
  describe('DELETE /api/rrhh/derechohabiente/:id/desactivar - desactivar', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe procesar la baja lógica (Soft Delete) del derechohabiente', async () => {
        // Arrange
        const mockDesactivado = { id: mockDerechohabienteId, activo: false, deleted_at: new Date() };
        mockEstadoUseCase.desactivar.mockResolvedValue(mockDesactivado);

        // Act
        const result = await controller.desactivar(mockDerechohabienteId);

        // Assert
        expect(estadoUseCase.desactivar).toHaveBeenCalledWith(mockDerechohabienteId);
        expect(result).toEqual(mockDesactivado);
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe propagar NotFoundException si el derechohabiente no existe o ya está inactivo', async () => {
        // Arrange
        mockEstadoUseCase.desactivar.mockRejectedValue(
          new NotFoundException({
            title: 'Derechohabiente no encontrado',
            detail: 'El derechohabiente no existe o ya ha sido dado de baja.',
          }),
        );

        // Act & Assert
        await expect(controller.desactivar(mockDerechohabienteId)).rejects.toThrow(
          NotFoundException,
        );
      });
    });
  });

  // =========================================================================
  // 5. PATCH /api/rrhh/derechohabiente/:id/reactivar - reactivar
  // =========================================================================
  describe('PATCH /api/rrhh/derechohabiente/:id/reactivar - reactivar', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe reactivar al derechohabiente limpiando el estado de baja', async () => {
        // Arrange
        const mockReactivado = { id: mockDerechohabienteId, activo: true, deleted_at: null };
        mockEstadoUseCase.reactivar.mockResolvedValue(mockReactivado);

        // Act
        const result = await controller.reactivar(mockDerechohabienteId);

        // Assert
        expect(estadoUseCase.reactivar).toHaveBeenCalledWith(mockDerechohabienteId);
        expect(result).toEqual(mockReactivado);
      });
    });

    describe('Validaciones de Negocio y Excepciones', () => {
      it('Debe propagar BadRequestException si el familiar ya se encuentra activo', async () => {
        // Arrange
        mockEstadoUseCase.reactivar.mockRejectedValue(
          new BadRequestException({
            title: 'Derechohabiente ya activo',
            detail: 'El familiar ya se encuentra activo en el sistema.',
          }),
        );

        // Act & Assert
        await expect(controller.reactivar(mockDerechohabienteId)).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });
});