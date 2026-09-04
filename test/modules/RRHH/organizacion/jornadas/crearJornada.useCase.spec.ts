import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CrearJornadaUseCase } from '@/modules/RRHH/organizacion/use-cases/jornadas/crearJornada.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { CrearJornadaDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el caso de uso CrearJornadaUseCase, que maneja la creación de jornadas laborales en el módulo de RRHH.
 * Se simula el comportamiento del servicio Prisma para verificar la lógica de negocio y las excepciones lanzadas en diferentes escenarios.
 * Se incluyen pruebas para creación exitosa, validación de duplicados y resiliencia ante fallos de base de datos.
 */
describe('CrearJornadaUseCase - Pruebas Unitarias', () => {
  let useCase: CrearJornadaUseCase;
  let prisma: PrismaService;

  //Mockear las funciones del servicio Prisma para simular la interacción con la base de datos
  const mockPrismaService = {
    jornada: { findFirst: jest.fn(), create: jest.fn() },
    area: { findMany: jest.fn() },
    jornada_area: { createMany: jest.fn() },
    $transaction: jest.fn(async (cb: any) => {
      if (typeof cb === 'function') 
        return await cb(mockPrismaService);
      
      return Promise.all(cb);
    }),
  };

  //Definir un horario semanal válido para las pruebas
  const horarioSemanalValido = [
    { dia: 'LUNES', laborable: true, modalidad: 'PRESENCIAL', entrada: '08:00', inicio_descanso: '13:00', fin_descanso: '14:00', salida: '17:00' },
    { dia: 'MARTES', laborable: true, modalidad: 'PRESENCIAL', entrada: '08:00', inicio_descanso: '13:00', fin_descanso: '14:00', salida: '17:00' },
    { dia: 'MIERCOLES', laborable: true, modalidad: 'PRESENCIAL', entrada: '08:00', inicio_descanso: '13:00', fin_descanso: '14:00', salida: '17:00' },
    { dia: 'JUEVES', laborable: true, modalidad: 'PRESENCIAL', entrada: '08:00', inicio_descanso: '13:00', fin_descanso: '14:00', salida: '17:00' },
    { dia: 'VIERNES', laborable: true, modalidad: 'PRESENCIAL', entrada: '08:00', inicio_descanso: '13:00', fin_descanso: '14:00', salida: '17:00' },
    { dia: 'SABADO', laborable: false, modalidad: 'PRESENCIAL', entrada: null, inicio_descanso: null, fin_descanso: null, salida: null },
    { dia: 'DOMINGO', laborable: false, modalidad: 'PRESENCIAL', entrada: null, inicio_descanso: null, fin_descanso: null, salida: null }
  ] as any;

  //Definir un payload válido para la creación de jornada
  const payloadValido: CrearJornadaDto = {
    nombre: 'Jornada Administrativa 40h',
    descripcion: 'Lunes a Viernes de 8 a 17 con 1h de refrigerio',
    duracion: 'TIEMPO_COMPLETO',
    turno: 'MANANA',
    modalidad: 'PRESENCIAL',
    tolerancia_minutos: 10,
    areas_ids: ['area-uuid-1', 'area-uuid-2'],
    horario_semanal: horarioSemanalValido,
    activo: true
  };

  //Configurar el módulo de pruebas antes de cada test
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

  afterEach(() => jest.clearAllMocks());

  //Pruebas para el caso de uso CrearJornadaUseCase
  describe('Creación Exitosa (Happy Path)', () => {
    it('Debe registrar exitosamente una jornada descontando refrigerio y asociando áreas', async () => {
      //Arrange: Simular que no existe una jornada con el mismo nombre y que las áreas existen
      mockPrismaService.jornada.findFirst.mockResolvedValue(null);
      mockPrismaService.area.findMany.mockResolvedValue([{ id: 'area-uuid-1' }, { id: 'area-uuid-2' }]);
      mockPrismaService.jornada.create.mockResolvedValue({
        id: 'jornada-uuid-100',
        ...payloadValido,
        total_horas_semana: 40
      });

      //Act: Ejecutar el caso de uso con el payload válido
      const result = await useCase.execute(payloadValido);

      //Assert: Verificar que se llamaron las funciones de Prisma con los parámetros correctos y que el resultado es el esperado
      expect(prisma.jornada.findFirst).toHaveBeenCalledWith({ where: { nombre: { equals: 'Jornada Administrativa 40h', mode: 'insensitive' }, deleted_at: null }});
      expect(prisma.area.findMany).toHaveBeenCalledWith({
        where: { id: { in: payloadValido.areas_ids }, activo: true, deleted_at: null },
        select: { id: true }
      });

      //Verificar que se creó la jornada con los datos correctos
      expect(mockPrismaService.jornada_area.createMany).toHaveBeenCalledWith({
        data: [
          { jornada_id: 'jornada-uuid-100', area_id: 'area-uuid-1' },
          { jornada_id: 'jornada-uuid-100', area_id: 'area-uuid-2' }
        ]
      });

      //Verificar que el resultado final contiene los datos esperados
      expect(result.id).toBe('jornada-uuid-100');
      expect(result.total_horas_semana).toBe(40);
      expect(result.areas_aplicables_ids).toEqual(payloadValido.areas_ids);
    });

    it('Debe registrar turno ROTATIVO si se especifica el patron_rotacion', async () => {
      //Arrange: Preparar un payload con turno ROTATIVO y patron_rotacion
      const payloadRotativo: CrearJornadaDto = {
        ...payloadValido,
        turno: 'ROTATIVO',
        patron_rotacion: {
          tipo_ciclo: '6x1',
          dias_trabajo: 6,
          dias_descanso: 1,
          frecuencia_cambio: 'SEMANAL',
          turnos_base: ['MANANA', 'TARDE']
        }
      };

      //Simular que no existe una jornada con el mismo nombre y que las áreas existen
      mockPrismaService.jornada.findFirst.mockResolvedValue(null);
      mockPrismaService.area.findMany.mockResolvedValue([{ id: 'area-uuid-1' }, { id: 'area-uuid-2' }]);
      mockPrismaService.jornada.create.mockResolvedValue({ id: 'jornada-uuid-100', ...payloadRotativo });

      //Act: Ejecutar el caso de uso con el payload de turno ROTATIVO
      const result = await useCase.execute(payloadRotativo);

      //Assert: Verificar que el resultado contiene el turno ROTATIVO y que se llamó a Prisma con los datos correctos
      expect(result.turno).toBe('ROTATIVO');
      expect(mockPrismaService.jornada.create).toHaveBeenCalledWith( expect.objectContaining({
        data: expect.objectContaining({
          turno: 'ROTATIVO',
          patron_rotacion: payloadRotativo.patron_rotacion
        })})
      );
    });
  });

  describe('Validaciones de Negocio', () => {
    it('Debe lanzar BadRequestException si el nombre ya existe', async () => {
      //Arrange: Simular que ya existe una jornada con el mismo nombre
      mockPrismaService.jornada.findFirst.mockResolvedValue({ id: 'otra-jornada' });

      //Act & Assert: Ejecutar el caso de uso y esperar que lance BadRequestException
      await expect(useCase.execute(payloadValido)).rejects.toThrow(BadRequestException);
      expect(prisma.area.findMany).not.toHaveBeenCalled();
    });

    it('Debe lanzar NotFoundException si alguna área no existe o está inactiva', async () => {
      //Arrange: Simular que no existe una jornada con el mismo nombre y que solo una de las áreas existe
      mockPrismaService.jornada.findFirst.mockResolvedValue(null);
      mockPrismaService.area.findMany.mockResolvedValue([{ id: 'area-uuid-1' }]); //Solo 1 de las 2 áreas existe

      //Act & Assert: Ejecutar el caso de uso y esperar que lance NotFoundException
      await expect(useCase.execute(payloadValido)).rejects.toThrow(NotFoundException);
    });

    it('Debe lanzar BadRequestException si el turno es ROTATIVO pero no incluye patron_rotacion', async () => {
      //Arrange: Preparar un payload con turno ROTATIVO pero sin patron_rotacion
      const payloadInvalido = { ...payloadValido, turno: 'ROTATIVO', patron_rotacion: null } as any;

      //Simular que no existe una jornada con el mismo nombre y que las áreas existen
      mockPrismaService.jornada.findFirst.mockResolvedValue(null);
      mockPrismaService.area.findMany.mockResolvedValue([{ id: 'area-uuid-1' }, { id: 'area-uuid-2' }]);

      //Act & Assert: Ejecutar el caso de uso y esperar que lance BadRequestException
      await expect(useCase.execute(payloadInvalido)).rejects.toThrow(BadRequestException);
    });

    it('Debe lanzar BadRequestException si excede las 48 horas semanales', async () => {
      //Preparar un horario semanal que exceda las 48 horas (por ejemplo, 5 días de 10h = 50h)
      //5 días de 10h = 50 horas semanales
      const horarioExcedido = horarioSemanalValido.map((dia: any) =>
        dia.laborable ? { ...dia, entrada: '07:00', salida: '18:00', inicio_descanso: '13:00', fin_descanso: '14:00' } : dia,
      );

      //Simular que no existe una jornada con el mismo nombre y que las áreas existen
      mockPrismaService.jornada.findFirst.mockResolvedValue(null);
      mockPrismaService.area.findMany.mockResolvedValue([{ id: 'area-uuid-1' }, { id: 'area-uuid-2' }]);

      //Act & Assert: Ejecutar el caso de uso y esperar que lance BadRequestException por exceder las 48 horas
      await expect(useCase.execute({ ...payloadValido, horario_semanal: horarioExcedido })).rejects.toThrow(BadRequestException);
    });

    it('Debe lanzar BadRequestException si es TIEMPO_PARCIAL pero supera o iguala las 30 horas', async () => {
      //Assert: Preparar un horario semanal que tenga 30 horas o más (por ejemplo, 5 días de 6h = 30h)
      mockPrismaService.jornada.findFirst.mockResolvedValue(null);
      mockPrismaService.area.findMany.mockResolvedValue([{ id: 'area-uuid-1' }, { id: 'area-uuid-2' }]);

      //Act & Assert: Ejecutar el caso de uso y esperar que lance BadRequestException por exceder las 30 horas para tiempo parcial
      await expect(useCase.execute({ ...payloadValido, duracion: 'TIEMPO_PARCIAL' })).rejects.toThrow(BadRequestException);
    });

    it('Debe envolver errores inesperados en InternalServerErrorException', async () => {
      //Arrange: Simular un fallo crítico de conexión a la base de datos al intentar buscar una jornada existente
      mockPrismaService.jornada.findFirst.mockRejectedValue(new Error('Fallo crítico de conexión'));

      //Act & Assert: Ejecutar el caso de uso y esperar que lance InternalServerErrorException
      await expect(useCase.execute(payloadValido)).rejects.toThrow(InternalServerErrorException);
    });
  });
});