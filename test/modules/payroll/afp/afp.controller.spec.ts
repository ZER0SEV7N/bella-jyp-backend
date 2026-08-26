
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AfpController } from '@/modules/payroll/afp/controller/afp.controller';

// Casos de Uso (Escritura)
import { AgregarAportacionUseCase } from '@/modules/payroll/afp/use-cases/aportacion/agregarAportacion.useCase';
import { AgregarComisionUseCase } from '@/modules/payroll/afp/use-cases/comision/agregarComision.useCase';
import { AgregarTipoAfpUseCase } from '@/modules/payroll/afp/use-cases/tipo-afp/agregarTipoAfp.useCase';

// Casos de Uso (Lectura)
import { ListarAportacionesUseCase } from '@/modules/payroll/afp/use-cases/aportacion/listarAportacion.useCase';
import { ListarComisionesUseCase } from '@/modules/payroll/afp/use-cases/comision/listarComision.useCase';
import { ListarTiposAfpUseCase } from '@/modules/payroll/afp/use-cases/tipo-afp/listarTipoAfp.useCase';

describe('AfpController', () => {
  let controller: AfpController;

  const mockUseCase = () => ({
    execute: jest.fn(),
    listar: jest.fn(),
  });

  const mocks = {
    agregarAportaciones: mockUseCase(),
    agregarComisiones: mockUseCase(),
    agregarTipoAfp: mockUseCase(),
    listarAportaciones: mockUseCase(),
    listarComisiones: mockUseCase(),
    listarTiposAfp: mockUseCase(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AfpController],
      providers: [
        { provide: AgregarAportacionUseCase, useValue: mocks.agregarAportaciones },
        { provide: AgregarComisionUseCase, useValue: mocks.agregarComisiones },
        { provide: AgregarTipoAfpUseCase, useValue: mocks.agregarTipoAfp },
        { provide: ListarAportacionesUseCase, useValue: mocks.listarAportaciones },
        { provide: ListarComisionesUseCase, useValue: mocks.listarComisiones },
        { provide: ListarTiposAfpUseCase, useValue: mocks.listarTiposAfp },
      ],
    }).compile();

    controller = module.get<AfpController>(AfpController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Endpoints de Tipos AFP', () => {
    it('Debería llamar a agregarTipoAfp', async () => {
      const payload = { nombre: 'AFP' } as any;
      mocks.agregarTipoAfp.execute.mockResolvedValue({ id: '1' });
      const result = await controller.asignarTipoAfp(payload);
      expect(result.id).toBe('1');
      expect(mocks.agregarTipoAfp.execute).toHaveBeenCalledWith(payload);
    });

    it('Debería relanzar errores del UseCase de Tipos AFP', async () => {
      mocks.agregarTipoAfp.execute.mockRejectedValue(new BadRequestException('Error'));
      await expect(controller.asignarTipoAfp({} as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Endpoints de Comisiones', () => {
    it('Debería llamar a agregarComisiones', async () => {
      const payload = { nueva_comision: {} } as any;
      mocks.agregarComisiones.execute.mockResolvedValue({ id: '1' });
      const result = await controller.agregarComision(payload);
      expect(result.id).toBe('1');
      expect(mocks.agregarComisiones.execute).toHaveBeenCalledWith(payload);
    });

    it('Debería llamar a listarComision', async () => {
      const query = { solo_vigentes: true } as any;
      mocks.listarComisiones.listar.mockResolvedValue({ data: [] });
      const result = await controller.listarComision(query);
      expect(result.data).toBeDefined();
      expect(mocks.listarComisiones.listar).toHaveBeenCalledWith(query);
    });
  });
});