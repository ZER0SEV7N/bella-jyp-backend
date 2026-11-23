import { Test } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ValidarDniUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/validarDni.useCase'; // ajusta el nombre/ruta de tu archivo

describe('ValidarDniUseCase', () => {
  let useCase: ValidarDniUseCase;
  let prisma: { empleados: { findUnique: jest.Mock } };

  const dni = '70112233';

  beforeEach(async () => {
    prisma = { empleados: { findUnique: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [ValidarDniUseCase, { provide: PrismaService, useValue: prisma }],
    }).compile();

    useCase = moduleRef.get(ValidarDniUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  describe('cuando no existe un empleado con el DNI', () => {
    it('retorna { disponible: true }', async () => {
      prisma.empleados.findUnique.mockResolvedValue(null);

      const result = await useCase.execute(dni);

      expect(result).toEqual({ disponible: true });
    });

    it('no incluye la clave empleado en la respuesta', async () => {
      prisma.empleados.findUnique.mockResolvedValue(null);

      const result = await useCase.execute(dni);

      expect(result).not.toHaveProperty('empleado');
    });
  });

  describe('cuando ya existe un empleado con el DNI', () => {
    it('retorna disponible false con los datos del empleado anidados', async () => {
      const empleado = {
        id: '018f4a7c-1111-7000-aaaa-000000000001',
        activo: true,
        estado_laboral: 'ACTIVO',
      };
      prisma.empleados.findUnique.mockResolvedValue(empleado);

      const result = await useCase.execute(dni);

      expect(result).toEqual({ disponible: false, empleado });
    });

    it('también marca como no disponible a un empleado inactivo (para poder reactivarlo)', async () => {
      const empleado = {
        id: '018f4a7c-1111-7000-aaaa-000000000002',
        activo: false,
        estado_laboral: 'CESADO',
      };
      prisma.empleados.findUnique.mockResolvedValue(empleado);

      const result = await useCase.execute(dni);

      expect(result).toEqual({ disponible: false, empleado });
    });
  });

  describe('consulta a la base de datos', () => {
    it('busca por nro_documento y selecciona solo id, activo y estado_laboral', async () => {
      prisma.empleados.findUnique.mockResolvedValue(null);

      await useCase.execute(dni);

      expect(prisma.empleados.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.empleados.findUnique).toHaveBeenCalledWith({
        where: { nro_documento: dni },
        select: { id: true, activo: true, estado_laboral: true },
      });
    });

    it('propaga el error si la base de datos falla', async () => {
      prisma.empleados.findUnique.mockRejectedValue(new Error('DB caída'));

      await expect(useCase.execute(dni)).rejects.toThrow('DB caída');
    });
  });
});