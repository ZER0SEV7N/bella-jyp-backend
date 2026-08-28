//test/modules/RRHH/organizacion/jornadas/editarJornada.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { EditarJornadaUseCase } from '@/modules/RRHH/organizacion/use-cases/jornadas/editarJornada.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActualizarJornadaDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el caso de uso EditarJornadaUseCase.
 * Se simula el comportamiento del servicio PrismaService para verificar que el caso de uso maneje correctamente
 * la lógica de actualización de jornadas, incluyendo actualizaciones parciales, colisión de nombres y manejo de excepciones.
 * Se valida que las excepciones sean propagadas adecuadamente en caso de errores o colisiones de datos.
 * Además, se incluyen pruebas para escenarios de resiliencia y manejo de errores inesperados.
 */
describe('EditarJornadaUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: EditarJornadaUseCase;
  let prisma: PrismaService;

  //Mock del servicio PrismaService para simular la interacción con la base de datos
  const mockPrisma = {
    jornada: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    }
  };

  //Datos simulados para las pruebas
  const idJornada = 'jornada-uuid-500';
  const jornadaExistente = {
    id: idJornada,
    nombre: 'Turno Mañana',
    tipo_jornada: 'FIJA',
    hora_entrada: new Date('1970-01-01T08:00:00.000Z'),
    hora_salida: new Date('1970-01-01T17:00:00.000Z'),
    tolerancia_minutos: 15,
    activo: true,
    deleted_at: null
  };

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditarJornadaUseCase,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();

    useCase = module.get<EditarJornadaUseCase>(EditarJornadaUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('Actualizaciones Parciales y Modificación de Horarios', () => {
    it('Happy Path: Debe actualizar parcialmente horas y tolerancia sin modificar el nombre', async () => {
      //Arrange: Se define un payload con cambios parciales y se simula la respuesta de PrismaService para findUnique y update
      const payload: ActualizarJornadaDto = {
        hora_entrada: '08:30',
        hora_salida: '17:30',
        tolerancia_minutos: 20
      };

      mockPrisma.jornada.findUnique.mockResolvedValue(jornadaExistente);
      mockPrisma.jornada.update.mockResolvedValue({...jornadaExistente, tolerancia_minutos: 20 });

      //Act: Se ejecuta el caso de uso con el id de la jornada y el payload de actualización
      const resultado = await useCase.execute(idJornada, payload);

      //Assert: Se verifica que PrismaService haya sido llamado correctamente y que el resultado contenga los cambios esperados
      expect(mockPrisma.jornada.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.jornada.update).toHaveBeenCalledWith({where: { id: idJornada }, data: expect.objectContaining({tolerancia_minutos: 20})});
      expect(resultado.tolerancia_minutos).toBe(20);
    });

    it('Happy Path: Debe actualizar la modalidad a ROTATIVA', async () => {
      //Arrange: Se define un payload para cambiar la modalidad de la jornada y se simula la respuesta de PrismaService para findUnique y update
      const payload: ActualizarJornadaDto = {tipo_jornada: 'ROTATIVA'};

      mockPrisma.jornada.findUnique.mockResolvedValue(jornadaExistente);
      mockPrisma.jornada.update.mockResolvedValue({...jornadaExistente, tipo_jornada: 'ROTATIVA'});

      //act: Se ejecuta el caso de uso con el id de la jornada y el payload de actualización
      const resultado = await useCase.execute(idJornada, payload);

      //Assert: Se verifica que PrismaService haya sido llamado correctamente y que el resultado contenga la modalidad actualizada
      expect(mockPrisma.jornada.update).toHaveBeenCalledWith({ where: { id: idJornada }, data: expect.objectContaining({tipo_jornada: 'ROTATIVA'})});
      expect(resultado.tipo_jornada).toBe('ROTATIVA');
    });

    it('Debe lanzar NotFoundException si la jornada no existe en BD', async () => {
      //Arrange: Se simula que PrismaService no encuentra la jornada en la base de datos
      mockPrisma.jornada.findUnique.mockResolvedValue(null);

      //Act & Assert: Se espera que el caso de uso lance NotFoundException al intentar actualizar una jornada inexistente
      await expect(useCase.execute(idJornada, { nombre: 'Nuevo Nombre' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si la jornada posee baja lógica (deleted_at !== null)', async () => {
      //Arrange: Se simula que PrismaService encuentra la jornada pero con baja lógica (deleted_at no es null)
      mockPrisma.jornada.findUnique.mockResolvedValue({...jornadaExistente, deleted_at: new Date()});

      //Act & Assert: Se espera que el caso de uso lance NotFoundException al intentar actualizar una jornada con baja lógica
      await expect(useCase.execute(idJornada, { nombre: 'Nuevo Nombre' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });
  });

  describe('Colisión de Nombres y Resiliencia', () => {
    it('Debe lanzar BadRequestException si el nuevo nombre colisiona con otra jornada existente', async () => {
      //Arrange: Se define un payload con un nombre que colisiona con otra jornada y se simula la respuesta de PrismaService para findUnique y findFirst
      const payload: ActualizarJornadaDto = {nombre: 'Turno Nocturno Existente'};

      mockPrisma.jornada.findUnique.mockResolvedValue(jornadaExistente);
      mockPrisma.jornada.findFirst.mockResolvedValue({ id: 'otra-jornada-id', nombre: 'Turno Nocturno Existente' });

      //Act & Assert: Se espera que el caso de uso lance BadRequestException al intentar actualizar con un nombre colisionante
      await expect(useCase.execute(idJornada, payload)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.jornada.findFirst).toHaveBeenCalledWith({where: {
        nombre: { equals: 'Turno Nocturno Existente', mode: 'insensitive' },
        id: { not: idJornada },
        deleted_at: null }
      });
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });
  });
});