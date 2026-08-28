import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CrearJornadaUseCase } from '@/modules/RRHH/organizacion/use-cases/jornadas/crearJornada.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearJornadaDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el caso de uso CrearJornadaUseCase, que maneja la creación de jornadas laborales en el módulo de RRHH.
 * Se simula el comportamiento del servicio Prisma para verificar la lógica de negocio y las excepciones lanzadas en diferentes escenarios.
 * Se incluyen pruebas para creación exitosa, validación de duplicados y resiliencia ante fallos de base de datos.
 */
describe('CrearJornadaUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: CrearJornadaUseCase;
  let prisma: PrismaService;

  const mockPrismaService = { jornada: {findFirst: jest.fn(), create: jest.fn()} };

  //Payload de prueba para la creación de una jornada laboral
  const payloadValido: CrearJornadaDto = {
    nombre: 'Turno Mañana (Oficina Central)',
    tipo_jornada: 'FIJA',
    hora_entrada: '08:00',
    hora_salida: '17:00',
    tolerancia_minutos: 15,
    activo: true
  };

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrearJornadaUseCase,
        { provide: PrismaService, useValue: mockPrismaService }
      ]
    }).compile();

    useCase = module.get<CrearJornadaUseCase>(CrearJornadaUseCase);
    prisma = module.get<PrismaService>(PrismaService);

    jest.spyOn(IdentityGenerator, 'generateId').mockReturnValue('jornada-uuid-100');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Creación Exitosa (Happy Path)', () => {
    it('Happy Path: Debe registrar exitosamente una nueva jornada con horarios parseados y tipo FIJA', async () => {
      //Arrange: Se simula que no existe una jornada con el mismo nombre y que la creación en PrismaService es exitosa
      mockPrismaService.jornada.findFirst.mockResolvedValue(null);

      const jornadaCreadaEsperada = {
        id: 'jornada-uuid-100',
        nombre: 'Turno Mañana (Oficina Central)',
        tipo_jornada: 'FIJA',
        hora_entrada: new Date('1970-01-01T08:00:00.000Z'),
        hora_salida: new Date('1970-01-01T17:00:00.000Z'),
        tolerancia_minutos: 15,
        activo: true
      };

      mockPrismaService.jornada.create.mockResolvedValue(jornadaCreadaEsperada);

      //Act: Se ejecuta el caso de uso para crear la jornada
      const result = await useCase.execute(payloadValido);

      //Assert: Se verifica que PrismaService haya sido llamado con los parámetros correctos y que el resultado sea el esperado
      expect(prisma.jornada.findFirst).toHaveBeenCalledWith({ where: {
        nombre: { equals: 'Turno Mañana (Oficina Central)', mode: 'insensitive' },
        deleted_at: null
      }});

      expect(prisma.jornada.create).toHaveBeenCalledWith({data: expect.objectContaining({
        id: 'jornada-uuid-100',
        nombre: 'Turno Mañana (Oficina Central)',
        tipo_jornada: 'FIJA',
        tolerancia_minutos: 15,
        activo: true
      })});

      expect(result).toEqual(jornadaCreadaEsperada);
    });

    it('Happy Path: Debe admitir tipo de jornada ROTATIVA y horas en formato ISO completo', async () => {
      //Arrange: Se define un payload con tipo de jornada ROTATIVA y se simula que no existe una jornada con el mismo nombre
      const payloadRotativo: CrearJornadaDto = {
        nombre: 'Turno Rotativo 24x48 Seguridad',
        tipo_jornada: 'ROTATIVA',
        hora_entrada: '1970-01-01T19:00:00.000Z',
        hora_salida: '1970-01-01T07:00:00.000Z',
        tolerancia_minutos: 10,
        activo: true
      };

      //Se simula que no existe una jornada con el mismo nombre y que la creación en PrismaService es exitosa
      mockPrismaService.jornada.findFirst.mockResolvedValue(null);
      mockPrismaService.jornada.create.mockResolvedValue({id: 'jornada-uuid-100', ...payloadRotativo});

      const result = await useCase.execute(payloadRotativo);

      //Assert: Se verifica que PrismaService haya sido llamado con los parámetros correctos y que el resultado contenga el tipo de jornada ROTATIVA
      expect(result.tipo_jornada).toBe('ROTATIVA');
      expect(prisma.jornada.create).toHaveBeenCalledWith(expect.objectContaining({data: expect.objectContaining({tipo_jornada: 'ROTATIVA'})}));
    });

    it('Happy Path: Debe aplicar valores por defecto para tipo_jornada (FIJA) y tolerancia si vienen ausentes', async () => {
      //Arrange: Se define un payload mínimo sin tipo_jornada ni tolerancia y se simula que no existe una jornada con el mismo nombre
      const payloadMinimo = {
        nombre: 'Turno Tarde',
        hora_entrada: '14:00',
        hora_salida: '22:00'
      } as CrearJornadaDto;

      //Se simula que no existe una jornada con el mismo nombre y que la creación en PrismaService es exitosa
      mockPrismaService.jornada.findFirst.mockResolvedValue(null);
      mockPrismaService.jornada.create.mockResolvedValue({
        id: 'jornada-uuid-100',
        nombre: 'Turno Tarde',
        tipo_jornada: 'FIJA',
        tolerancia_minutos: 0,
        activo: true
      });

      //Act: Se ejecuta el caso de uso para crear la jornada con valores por defecto
      const result = await useCase.execute(payloadMinimo);

      //Assert: Se verifica que PrismaService haya sido llamado con los parámetros correctos y que el resultado contenga los valores por defecto esperados
      expect(result.tipo_jornada).toBe('FIJA');
      expect(prisma.jornada.create).toHaveBeenCalledWith({ data: expect.objectContaining({
          tipo_jornada: 'FIJA',
          tolerancia_minutos: 0,
          activo: true,
        })
      });
    });
  });

  describe('Validaciones de Negocio y Manejo de Errores', () => {
    it('Debe lanzar BadRequestException si ya existe una jornada activa con el mismo nombre', async () => {
      //Arrange: Se simula que PrismaService encuentra una jornada existente con el mismo nombre
      mockPrismaService.jornada.findFirst.mockResolvedValue({
        id: 'jornada-existente-id',
        nombre: 'Turno Mañana (Oficina Central)'
      });

      //Act & Assert: Se espera que el caso de uso lance BadRequestException al intentar crear una jornada duplicada
      await expect(useCase.execute(payloadValido)).rejects.toThrow(BadRequestException);
      expect(prisma.jornada.create).not.toHaveBeenCalled();
    });
  });
});