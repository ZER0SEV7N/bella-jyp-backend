//test/modules/RRHH/organizacion/derechohabiente/registrarDerechohabiente.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { RegistrarDerechohabienteUseCase } from '@/modules/RRHH/organizacion/use-cases/derechohabiente/registrarDerechohabiente.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { RegistrarDerechohabienteDto } from '@jyp/shared-contracts';

/**
 * Prueba unitaria exhaustiva para el caso de uso RegistrarDerechohabienteUseCase.
 * Esta prueba cubre los casos de éxito y error más comunes para garantizar el correcto funcionamiento del caso de uso.
 */
describe('RegistrarDerechohabienteUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: RegistrarDerechohabienteUseCase;
  let prisma: PrismaService;

  //Mock del servicio Prisma para simular interacciones con la base de datos
  const mockPrisma = {
    empleados: { findUnique: jest.fn(), update: jest.fn() },
    derechohabientes: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(async (cb: any) => {
      if (typeof cb === 'function') return await cb(mockPrisma);
      return Promise.all(cb);
    }),
  };

  //Datos de prueba para un derechohabiente de tipo HIJO_MENOR
  const payloadHijo: RegistrarDerechohabienteDto = {
    empleado_id: '018f4a7c-9999-7000-3333-000000000002',
    documento_id: '018f4a7c-2222-7000-b000-000000000001',
    nro_documento: '91223344',
    nombres: 'Mateo',
    apellidos: 'Ramírez Vargas',
    vinculo: 'HIJO_MENOR',
    estado_civil: 'SOLTERO',
    sexo: 'MASCULINO',
    fecha_nacimiento: '2020-05-15'
  };

  //Configuración inicial de cada prueba
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrarDerechohabienteUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    //Obtener instancias de los servicios y casos de uso a probar
    useCase = module.get<RegistrarDerechohabienteUseCase>(RegistrarDerechohabienteUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    //Mockear la generación de UUID para garantizar consistencia en las pruebas
    jest.spyOn(IdentityGenerator, 'generateId').mockReturnValue('dh-uuid-100');
  });

  afterEach(() => jest.clearAllMocks());

  describe('Casos de Éxito (Happy Path)', () => {
    it('Debe registrar exitosamente un HIJO_MENOR y activar asignación familiar si el titular no la tenía', async () => {
      //Arrange: Configurar mocks para simular la existencia del empleado titular y la no existencia previa del derechohabiente
      mockPrisma.empleados.findUnique.mockResolvedValue({
        id: payloadHijo.empleado_id,
        activo: true,
        asig_familiar: false
      });

      //Simular que no existe un derechohabiente con el mismo documento
      mockPrisma.derechohabientes.findFirst.mockResolvedValue(null);
      mockPrisma.derechohabientes.create.mockResolvedValue({
        id: 'dh-uuid-100',
        ...payloadHijo,
        activo: true
      });

      //Act: Ejecutar el caso de uso con el payload de prueba
      const result = await useCase.execute(payloadHijo);

      //Assert: Validar que se haya creado el derechohabiente con los datos correctos y que se haya activado la asignación familiar
      expect(result.id).toBe('dh-uuid-100');
      expect(mockPrisma.derechohabientes.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'dh-uuid-100',
          empleado_id: payloadHijo.empleado_id,
          nro_documento: '91223344',
          vinculo: 'HIJO_MENOR',
          activo: true,
          acreditado_essalud: false,
          fecha_nacimiento: expect.any(Date)
        }),
        include: { tipo_documento: { select: { id: true, tipo_documento: true } } }
      });

      //Validar que se haya actualizado la bandera de asignación familiar del empleado titular
      expect(mockPrisma.empleados.update).toHaveBeenCalledWith({
        where: { id: payloadHijo.empleado_id },
        data: { asig_familiar: true }
      });
    });

    it('Debe registrar CONYUGE sin alterar la bandera de asignación familiar', async () => {
      //Arrange: Configurar un payload para un derechohabiente de tipo CONYUGE
      const payloadConyuge: RegistrarDerechohabienteDto = {
        ...payloadHijo,
        vinculo: 'CONYUGE',
        nro_documento: '72334455',
        fecha_nacimiento: '1992-04-10'
      };

      //Mockear la existencia del empleado titular y la no existencia previa del derechohabiente
      mockPrisma.empleados.findUnique.mockResolvedValue({
        id: payloadConyuge.empleado_id,
        activo: true,
        asig_familiar: false
      });

      //Mockear la búsqueda de derechohabiente para que no encuentre duplicados y simular la creación exitosa del derechohabiente
      mockPrisma.derechohabientes.findFirst.mockResolvedValue(null);
      mockPrisma.derechohabientes.create.mockResolvedValue({
        id: 'dh-uuid-100',
        ...payloadConyuge
      });

      //Act: Ejecutar el caso de uso con el payload de prueba para CONYUGE
      await useCase.execute(payloadConyuge);

      //Assert: Validar que se haya creado el derechohabiente y que no se haya modificado la bandera de asignación familiar
      expect(mockPrisma.empleados.update).not.toHaveBeenCalled();
      expect(mockPrisma.derechohabientes.create).toHaveBeenCalled();
    });
  });

  describe('Validaciones de Negocio y Excepciones', () => {
    it('Debe lanzar NotFoundException si el colaborador titular no existe o está cesado', async () => {
      //Arrange: Configurar el mock para simular que el empleado titular no existe
      mockPrisma.empleados.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutar el caso de uso y esperar que lance NotFoundException
      await expect(useCase.execute(payloadHijo)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.derechohabientes.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar ConflictException si el derechohabiente ya se encuentra registrado', async () => {
      //Arrange: Configurar mocks para simular la existencia del empleado titular y la existencia previa del derechohabiente
      mockPrisma.empleados.findUnique.mockResolvedValue({
        id: payloadHijo.empleado_id,
        activo: true
      });
      mockPrisma.derechohabientes.findFirst.mockResolvedValue({ id: 'duplicado-uuid' });

      //Act & Assert: Ejecutar el caso de uso y esperar que lance ConflictException
      await expect(useCase.execute(payloadHijo)).rejects.toThrow(ConflictException);
      expect(mockPrisma.derechohabientes.create).not.toHaveBeenCalled();
    });

    it('Debe lanzar BadRequestException si la edad supera el límite de HIJO_MENOR', async () => {
      //Arrange: Configurar un payload con fecha de nacimiento que exceda el límite de edad para HIJO_MENOR
      const payloadAdulto = { ...payloadHijo, fecha_nacimiento: '2004-01-01' };

      //Mockear la existencia del empleado titular y la no existencia previa del derechohabiente
      mockPrisma.empleados.findUnique.mockResolvedValue({
        id: payloadAdulto.empleado_id,
        activo: true
      });
      mockPrisma.derechohabientes.findFirst.mockResolvedValue(null);

      //Act & Assert: Ejecutar el caso de uso y esperar que lance BadRequestException debido a la edad no válida
      await expect(useCase.execute(payloadAdulto)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.derechohabientes.create).not.toHaveBeenCalled();
    });

    it('Debe transformar fallos inesperados de BD a InternalServerErrorException', async () => {
      //Arrange: Configurar mocks para simular un error inesperado de la base de datos durante la creación del derechohabiente
      mockPrisma.empleados.findUnique.mockResolvedValue({
        id: payloadHijo.empleado_id,
        activo: true
      });

      //Simular que no existe un derechohabiente con el mismo documento 
      //y provocar un error de base de datos al intentar crear el derechohabiente
      mockPrisma.derechohabientes.findFirst.mockResolvedValue(null);
      mockPrisma.derechohabientes.create.mockRejectedValue(new Error('PostgreSQL deadlock'));

      //Act & Assert: Ejecutar el caso de uso y esperar que lance InternalServerErrorException debido al error de BD
      await expect(useCase.execute(payloadHijo)).rejects.toThrow(InternalServerErrorException);
    });
  });
});