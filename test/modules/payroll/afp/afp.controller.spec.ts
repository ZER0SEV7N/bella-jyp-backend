//test/modules/payroll/afp/afp.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {BadRequestException,NotFoundException, InternalServerErrorException} from '@nestjs/common';
import { AfpController } from '@/modules/payroll/afp/controller/afp.controller';
import { AgregarAportacionUseCase } from '@/modules/payroll/afp/use-cases/aportacion/agregarAportacion.useCase';
import { ListarAportacionesUseCase } from '@/modules/payroll/afp/use-cases/aportacion/listarAportacion.useCase';
import { AgregarComisionUseCase } from '@/modules/payroll/afp/use-cases/comision/agregarComision.useCase';
import { ListarComisionesUseCase } from '@/modules/payroll/afp/use-cases/comision/listarComision.useCase';
import { AgregarTipoAfpUseCase } from '@/modules/payroll/afp/use-cases/tipo-afp/agregarTipoAfp.useCase';
import { ListarTiposAfpUseCase } from '@/modules/payroll/afp/use-cases/tipo-afp/listarTipoAfp.useCase';
import type {
  CrearTipoAfpDto,
  CrearComisionDto,
  AportacionDto,
  ListarTiposAfpQueryDto,
  ListarComisionesQueryDto,
  ListarAportacionesQueryDto,
} from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el AfpController, que cubren todos los endpoints HTTP relacionados con aportaciones, comisiones y tipos de AFP.
 * Estas pruebas verifican tanto los casos felices como las excepciones y errores de negocio, 
 * asegurando que el controlador maneje correctamente las solicitudes y delegue a los casos de uso correspondientes.
 * Se utilizan mocks para todos los casos de uso inyectados en el controlador, 
 * permitiendo simular diferentes escenarios sin depender de la implementación real.
 */
describe('AfpController - Pruebas Unitarias Exhaustivas de Endpoints HTTP', () => {
  let controller: AfpController;

  const mockAgregarAportacionUseCase = { execute: jest.fn() };
  const mockListarAportacionesUseCase = { listar: jest.fn() };
  const mockAgregarComisionUseCase = { execute: jest.fn() };
  const mockListarComisionesUseCase = { listar: jest.fn() };
  const mockAgregarTipoAfpUseCase = { execute: jest.fn() };
  const mockListarTiposAfpUseCase = { listar: jest.fn() };

  const mockAfpId = '018f4a7c-5555-7000-e000-000000000001';
  const mockRegimenId = '018f4a7c-4444-7000-d000-000000000002';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AfpController],
      providers: [
        { provide: AgregarAportacionUseCase, useValue: mockAgregarAportacionUseCase },
        { provide: ListarAportacionesUseCase, useValue: mockListarAportacionesUseCase },
        { provide: AgregarComisionUseCase, useValue: mockAgregarComisionUseCase },
        { provide: ListarComisionesUseCase, useValue: mockListarComisionesUseCase },
        { provide: AgregarTipoAfpUseCase, useValue: mockAgregarTipoAfpUseCase },
        { provide: ListarTiposAfpUseCase, useValue: mockListarTiposAfpUseCase },
      ],
    }).compile();

    controller = module.get<AfpController>(AfpController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Aportaciones HTTP Endpoints', () => {
    describe('POST /api/afp/aportaciones - agregarAportacion()', () => {
      const payload: AportacionDto = {
        nombre: 'Aporte Obligatorio Fondo',
        afp_id: mockAfpId,
        cantidad: 10.0,
      };

      it('Happy Path: Debe registrar exitosamente una nueva aportación', async () => {
        const mockCreated = { id: 'aportacion-uuid-1', ...payload };
        mockAgregarAportacionUseCase.execute.mockResolvedValueOnce(mockCreated);

        const result = await controller.agregarAportacion(payload);

        expect(mockAgregarAportacionUseCase.execute).toHaveBeenCalledWith(payload);
        expect(result).toEqual(mockCreated);
      });

      it('Excepción: Debe propagar NotFoundException si la AFP asignada no existe', async () => {
        mockAgregarAportacionUseCase.execute.mockRejectedValueOnce(new NotFoundException('No se puede registrar la aportación porque la AFP no existe.'));

        await expect(controller.agregarAportacion(payload)).rejects.toThrow(NotFoundException);
      });

      it('Excepción / Resiliencia: Debe propagar InternalServerErrorException ante fallos inesperados', async () => {
        mockAgregarAportacionUseCase.execute.mockRejectedValueOnce(new InternalServerErrorException('Error al registrar aportación.'));

        await expect(controller.agregarAportacion(payload)).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('GET /api/afp/aportaciones - listarAportacion()', () => {
      it('Happy Path: Debe listar aportaciones paginadas delegando a ListarAportacionesUseCase', async () => {
        const query: ListarAportacionesQueryDto = { page: 1, limit: 10, afp_id: mockAfpId };
        const mockResponse = {
          data: [{ id: 'aportacion-1', nombre: 'Fondo', cantidad: 10.0 }],
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        };

        mockListarAportacionesUseCase.listar.mockResolvedValueOnce(mockResponse);

        const result = await controller.listarAportacion(query);

        expect(mockListarAportacionesUseCase.listar).toHaveBeenCalledWith(query);
        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('Comisiones HTTP Endpoints', () => {
    describe('POST /api/afp/comisiones - agregarComision()', () => {
      const payload: CrearComisionDto = {
        tipo_afp_id: mockAfpId,
        nueva_comision: {
          periodo_inicio: '2026-08-01',
          aporte_obligatorio: 10.0,
          comision_sobre_ra: 1.55,
          prima_seguro: 1.84,
          comision_mixta: 0.78
        }
      };

      it('Happy Path: Debe crear una nueva comisión de AFP exitosamente', async () => {
        const mockCreatedComision = {
          id: 'comision-uuid-1',
          afp_id: mockAfpId,
          ...payload.nueva_comision,
        };

        mockAgregarComisionUseCase.execute.mockResolvedValueOnce(mockCreatedComision);

        const result = await controller.agregarComision(payload);

        expect(mockAgregarComisionUseCase.execute).toHaveBeenCalledWith(payload);
        expect(result).toEqual(mockCreatedComision);
      });

      it('Excepción: Debe propagar NotFoundException si el tipo de AFP no existe', async () => {
        mockAgregarComisionUseCase.execute.mockRejectedValueOnce( new NotFoundException('La AFP seleccionada no existe.'));

        await expect(controller.agregarComision(payload)).rejects.toThrow(NotFoundException);
      });
    });

    describe('GET /api/afp/comisiones - listarComision()', () => {
      it('Happy Path: Debe listar las comisiones paginadas con filtros vigentes', async () => {
        const query: ListarComisionesQueryDto = {
          page: 1,
          limit: 10,
          afp_id: mockAfpId,
          solo_vigentes: true
        };

        const mockResponse = {
          data: [{
            id: 'comision-1',
            afp_id: mockAfpId,
            periodo_inicio: new Date('2026-08-01'),
            periodo_final: null,
          }],
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        };

        mockListarComisionesUseCase.listar.mockResolvedValueOnce(mockResponse);

        const result = await controller.listarComision(query);

        expect(mockListarComisionesUseCase.listar).toHaveBeenCalledWith(query);
        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('Tipos de AFP HTTP Endpoints', () => {
    describe('POST /api/afp/tipos - asignarTipoAfp()', () => {
      const payload: CrearTipoAfpDto = {
        id_regimen: mockRegimenId,
        nombre: 'AFP HABITAT'
      };

      it('Happy Path: Debe registrar un nuevo tipo de AFP', async () => {
        const mockCreatedAfp = {
          id: mockAfpId,
          ...payload
        };

        mockAgregarTipoAfpUseCase.execute.mockResolvedValueOnce(mockCreatedAfp);

        const result = await controller.asignarTipoAfp(payload);

        expect(mockAgregarTipoAfpUseCase.execute).toHaveBeenCalledWith(payload);
        expect(result).toEqual(mockCreatedAfp);
      });

      it('Excepción / Negocio: Debe propagar BadRequestException si el régimen es inválido o no es SPP/AFP', async () => {
        mockAgregarTipoAfpUseCase.execute.mockRejectedValueOnce(new BadRequestException('El régimen seleccionado no corresponde a un sistema AFP.'));

        await expect(controller.asignarTipoAfp(payload)).rejects.toThrow(BadRequestException);
      });

      it('Excepción / Negocio: Debe propagar BadRequestException si el nombre de la AFP ya existe', async () => {
        mockAgregarTipoAfpUseCase.execute.mockRejectedValueOnce(new BadRequestException(`Ya existe una AFP registrada con el nombre '${payload.nombre}'.`));

        await expect(controller.asignarTipoAfp(payload)).rejects.toThrow(BadRequestException);
      });
    });

    describe('GET /api/afp/tipos - listarAfp()', () => {
      it('Happy Path: Debe listar los tipos de AFP paginados', async () => {
        const query: ListarTiposAfpQueryDto = { page: 1, limit: 10 };
        const mockResponse = {
          data: [{
            id: mockAfpId,
            nombre: 'AFP INTEGRA',
            regimen_pension: { nombre: 'SPP (AFP)' },
          }],
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        };

        mockListarTiposAfpUseCase.listar.mockResolvedValueOnce(mockResponse);

        const result = await controller.listarAfp(query);

        expect(mockListarTiposAfpUseCase.listar).toHaveBeenCalledWith(query);
        expect(result).toEqual(mockResponse);
      });
    });
  });
});