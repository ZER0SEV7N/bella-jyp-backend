import { Test } from '@nestjs/testing';
import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ObtenerDatosReniecUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/obtenerDatosReniec.useCase'; 
import { ReniecAdapter } from '@/modules/RRHH/organizacion/services/reniec.adapter';

describe('ObtenerDatosReniecUseCase', () => {
  let useCase: ObtenerDatosReniecUseCase;
  let reniecAdapter: { consultarDni: jest.Mock };

  const dniValido = '70112233';

  beforeEach(async () => {
    reniecAdapter = { consultarDni: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [ObtenerDatosReniecUseCase, { provide: ReniecAdapter, useValue: reniecAdapter }],
    }).compile();

    useCase = moduleRef.get(ObtenerDatosReniecUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  describe('cuando el DNI es válido', () => {
    it('retorna nombre y apellidos obtenidos de RENIEC', async () => {
      reniecAdapter.consultarDni.mockResolvedValue({
        nombre: 'Carlos Alberto',
        apellido_paterno: 'Mendoza',
        apellido_materno: 'Pérez',
      });

      const result = await useCase.execute(dniValido);

      expect(result).toEqual({
        nombre: 'Carlos Alberto',
        apellido_paterno: 'Mendoza',
        apellido_materno: 'Pérez',
      });
    });

    it('consulta al adaptador exactamente una vez y con el DNI recibido', async () => {
      reniecAdapter.consultarDni.mockResolvedValue({
        nombre: 'Ana',
        apellido_paterno: 'Quispe',
        apellido_materno: 'Rojas',
      });

      await useCase.execute(dniValido);

      expect(reniecAdapter.consultarDni).toHaveBeenCalledTimes(1);
      expect(reniecAdapter.consultarDni).toHaveBeenCalledWith(dniValido);
    });

    it('expone únicamente los tres campos esperados', async () => {
      reniecAdapter.consultarDni.mockResolvedValue({
        nombre: 'Ana',
        apellido_paterno: 'Quispe',
        apellido_materno: 'Rojas',
        campo_extra: 'no debe salir',
      });

      const result = await useCase.execute(dniValido);

      expect(Object.keys(result).sort()).toEqual(['apellido_materno', 'apellido_paterno', 'nombre']);
    });
  });

  describe('cuando el DNI es inválido', () => {
    it.each([
      ['muy corto (7 dígitos)', '1234567'],
      ['muy largo (9 dígitos)', '123456789'],
      ['con letras', 'abcdefgh'],
      ['mezcla de letras y números', '1234567a'],
      ['con espacios', ' 7011223'],
      ['vacío', ''],
    ])('lanza BadRequestException si es %s', async (_descripcion, dni) => {
      await expect(useCase.execute(dni)).rejects.toThrow(BadRequestException);
    });

    it('no consulta a RENIEC', async () => {
      await expect(useCase.execute('123')).rejects.toThrow(BadRequestException);

      expect(reniecAdapter.consultarDni).not.toHaveBeenCalled();
    });
  });

  describe('cuando RENIEC falla', () => {
    it('propaga NotFoundException si el DNI no existe', async () => {
      reniecAdapter.consultarDni.mockRejectedValue(new NotFoundException('No se encontró el DNI en RENIEC.'));

      await expect(useCase.execute(dniValido)).rejects.toThrow(NotFoundException);
    });

    it('propaga BadGatewayException si el servicio no está disponible', async () => {
      reniecAdapter.consultarDni.mockRejectedValue(new BadGatewayException('Servicio de RENIEC no disponible.'));

      await expect(useCase.execute(dniValido)).rejects.toThrow(BadGatewayException);
    });
  });
});