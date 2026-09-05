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
describe('EditarJornadaUseCase - Pruebas Unitarias', () => {
  let useCase: EditarJornadaUseCase;
  let prisma: PrismaService;

  //Mock del servicio PrismaService para simular la interacción con la base de datos
  const mockPrisma = {
    jornada: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    area: { count: jest.fn() },
    jornada_area: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(async (cb: any) => {
      if (typeof cb === 'function') 
        return await cb(mockPrisma);
      
      return Promise.all(cb);
    })
  };

  //Datos de prueba para una jornada existente
  const idJornada = 'jornada-uuid-500';
  const jornadaExistente = {
    id: idJornada,
    nombre: 'Turno Mañana',
    descripcion: 'Original',
    duracion: 'TIEMPO_COMPLETO',
    turno: 'MANANA',
    modalidad: 'PRESENCIAL',
    tolerancia_minutos: 5,
    total_horas_semana: 40,
    horario_semanal: [],
    activo: true,
    deleted_at: null
  };

  //Configuración de pruebas antes de cada caso
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

  //Pruebas de casos exitosos de actualización
  describe('Actualizaciones Exitosas', () => {
    it('Debe actualizar datos simples sin alterar áreas ni horario semanal', async () => {
      //Arrange: Preparar un payload de actualización con cambios simples
      const payload: ActualizarJornadaDto = {
        descripcion: 'Descripción actualizada',
        tolerancia_minutos: 15
      };

      //Simular que la jornada existe y no hay colisión de nombres
      mockPrisma.jornada.findUnique.mockResolvedValue(jornadaExistente);
      mockPrisma.jornada.update.mockResolvedValue({ ...jornadaExistente, ...payload });

      //Act: Ejecutar el caso de uso
      const resultado = await useCase.execute(idJornada, payload);

      //Assert: Verificar que se haya llamado a los métodos correctos y que el resultado sea el esperado
      expect(mockPrisma.jornada.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: idJornada },
        data: expect.objectContaining({
          descripcion: 'Descripción actualizada',
          tolerancia_minutos: 15
        })})
      );
      //Verificar que no se haya intentado sincronizar áreas ni modificar el horario semanal
      expect(mockPrisma.jornada_area.deleteMany).not.toHaveBeenCalled();
      expect(resultado.tolerancia_minutos).toBe(15);
    });

    it('Debe sincronizar áreas correctamente si se envía areas_ids', async () => {
      //Arrange: Preparar un payload de actualización que incluya nuevas áreas
      const payload: ActualizarJornadaDto = {areas_ids: ['area-nueva-1', 'area-nueva-2']};

      //Simular que la jornada existe y que las áreas enviadas existen en la base de datos
      mockPrisma.jornada.findUnique.mockResolvedValue(jornadaExistente);
      mockPrisma.area.count.mockResolvedValue(2);
      mockPrisma.jornada.update.mockResolvedValue({ ...jornadaExistente });

      //Act: Ejecutar el caso de uso
      await useCase.execute(idJornada, payload);

      //Assert: Verificar que se haya llamado a los métodos correctos para sincronizar áreas
      expect(mockPrisma.area.count).toHaveBeenCalledWith({where: { id: { in: payload.areas_ids }, activo: true, deleted_at: null }});
      expect(mockPrisma.jornada_area.deleteMany).toHaveBeenCalledWith({ where: { jornada_id: idJornada } });
      expect(mockPrisma.jornada_area.createMany).toHaveBeenCalledWith({
        data: [
          { jornada_id: idJornada, area_id: 'area-nueva-1' },
          { jornada_id: idJornada, area_id: 'area-nueva-2' }
        ]
      });
    });
  });

  describe('Validaciones y Excepciones', () => {
    it('Debe lanzar NotFoundException si la jornada no existe o tiene baja lógica', async () => {
      //Arrange: Simular que la jornada no existe en la base de datos
      mockPrisma.jornada.findUnique.mockResolvedValue(null);

      //Act & Assert: Ejecutar el caso de uso y esperar que lance NotFoundException
      await expect(useCase.execute(idJornada, { nombre: 'Nuevo Nombre' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar BadRequestException si el nuevo nombre colisiona con otra jornada', async () => {
      //Arrange: Simular que la jornada existe y que el nuevo nombre ya está en uso por otra jornada
      mockPrisma.jornada.findUnique.mockResolvedValue(jornadaExistente);
      mockPrisma.jornada.findFirst.mockResolvedValue({ id: 'otra-jornada-id', nombre: 'Turno Nocturno' });

      //Act & Assert: Ejecutar el caso de uso y esperar que lance BadRequestException
      await expect(useCase.execute(idJornada, { nombre: 'Turno Nocturno' })).rejects.toThrow(BadRequestException);
      expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si alguna de las nuevas áreas no existe', async () => {
      //Arrange: Simular que la jornada existe y que se envían áreas, pero una de ellas no existe
      mockPrisma.jornada.findUnique.mockResolvedValue(jornadaExistente);
      mockPrisma.area.count.mockResolvedValue(1); // Se enviaron 2 pero solo existe 1

      //Act & Assert: Ejecutar el caso de uso y esperar que lance NotFoundException
      await expect(useCase.execute(idJornada, { areas_ids: ['area-1', 'area-invalida'] })).rejects.toThrow(NotFoundException);
    });

    it('Debe lanzar BadRequestException si el nuevo horario recalculado supera las 48 horas', async () => {
      //Arrange: Simular que la jornada existe y preparar un horario semanal que exceda las 48 horas
      mockPrisma.jornada.findUnique.mockResolvedValue(jornadaExistente);

      const horario50Horas = [
        { dia: 'LUNES', laborable: true, entrada: '07:00', salida: '17:00' },     // 10h
        { dia: 'MARTES', laborable: true, entrada: '07:00', salida: '17:00' },    // 10h
        { dia: 'MIERCOLES', laborable: true, entrada: '07:00', salida: '17:00' }, // 10h
        { dia: 'JUEVES', laborable: true, entrada: '07:00', salida: '17:00' },    // 10h
        { dia: 'VIERNES', laborable: true, entrada: '07:00', salida: '17:00' },   // 10h
        { dia: 'SABADO', laborable: false },
        { dia: 'DOMINGO', laborable: false },
      ] as any;

      //Act & Assert: Ejecutar el caso de uso y esperar que lance BadRequestException por exceder las 48 horas
      await expect(useCase.execute(idJornada, { horario_semanal: horario50Horas })).rejects.toThrow(BadRequestException);
    });

    it('Debe propagar InternalServerErrorException ante fallos no previstos', async () => {
      //Arrange: Simular un fallo inesperado en la base de datos al intentar buscar la jornada
      mockPrisma.jornada.findUnique.mockRejectedValue(new Error('Conexión perdida'));

      //Act & Assert: Ejecutar el caso de uso y esperar que lance InternalServerErrorException
      await expect(useCase.execute(idJornada, { descripcion: 'Prueba' })).rejects.toThrow(InternalServerErrorException);
    });
  });
});