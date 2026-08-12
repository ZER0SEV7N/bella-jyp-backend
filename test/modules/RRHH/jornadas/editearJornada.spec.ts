import { NotFoundException } from '@nestjs/common';
import { EditarJornadaUseCase } from '@/modules/RRHH/organizacion/use-cases/jornadas/editarJornada.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import type { ActualizarJornadaDto } from '@jyp/shared-contracts';
describe('editarJornadaUseCase', () => {
  let useCase: EditarJornadaUseCase;
  let mockPrisma: any;
  //incializar modulo de testis
  beforeEach(async () => {
    mockPrisma = {
      jornada: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditarJornadaUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    useCase = module.get<EditarJornadaUseCase>(EditarJornadaUseCase);
  });
  afterAll(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
  it('debe editar jornada sin saltar la excepción de jornada eliminada', async () => {
    const idJornada = '11-555-99';

    const datoPersistente = {
      id: idJornada,
      hora_entrada: new Date('2020-11-08T08:00:00.000Z'),
      hora_salida: new Date('2020-11-08T17:00:00.000Z'),
      deleted_at: null,
      nombre: 'jornada actual',
      tolerancia_minutos: 20,
      activo: true,
    };

    const payload: ActualizarJornadaDto = {
      activo: true,
      hora_entrada: '2020-11-08T08:00:20.000Z',
      hora_salida: '2020-11-08T17:11:00.000Z',
      nombre: 'jornada nueva',
      tolerancia_minutos: 30,
    };

    const jornadaActualizada = {
      ...datoPersistente,
      ...payload,
      hora_entrada: new Date(payload.hora_entrada),
      hora_salida: new Date(payload.hora_salida),
    };

    // simular que la jornada existe y no está eliminada
    mockPrisma.jornada.findUnique.mockResolvedValueOnce(datoPersistente);
    // simular la actualización exitosa
    mockPrisma.jornada.update.mockResolvedValueOnce(jornadaActualizada);

    const result = await useCase.execute(idJornada, payload);

    expect(result).toEqual(jornadaActualizada);
    expect(mockPrisma.jornada.update).toHaveBeenCalledTimes(1);
  });
  it('debe lanzar NotFoundException si la jornada está eliminada', async () => {
    const idJornada = '11-555-99';

    const jornadaEliminada = {
      id: idJornada,
      hora_entrada: new Date('2020-11-08T08:00:00.000Z'),
      hora_salida: new Date('2020-11-08T17:00:00.000Z'),
      deleted_at: new Date('2024-01-01T00:00:00.000Z'), // eliminada
      nombre: 'jornada actual',
      tolerancia_minutos: 20,
      activo: true,
    };

    const payload: ActualizarJornadaDto = {
      activo: true,
      hora_entrada: '2020-11-08T08:00:20.000Z',
      hora_salida: '2020-11-08T17:11:00.000Z',
      nombre: 'jornada nueva',
      tolerancia_minutos: 30,
    };

    mockPrisma.jornada.findUnique.mockResolvedValueOnce(jornadaEliminada);

    await expect(useCase.execute(idJornada, payload)).rejects.toThrow(
      NotFoundException,
    );

    expect(mockPrisma.jornada.findUnique).toHaveBeenCalledWith({
      where: { id: idJornada },
    });
    expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
  });
  it('debe lanzar NotFoundException si la jornada no existe', async () => {
    const idJornada = 'id-inexistente';

    const payload: ActualizarJornadaDto = {
      activo: true,
      hora_entrada: '2020-11-08T08:00:20.000Z',
      hora_salida: '2020-11-08T17:11:00.000Z',
      nombre: 'jornada nueva',
      tolerancia_minutos: 30,
    };

    mockPrisma.jornada.findUnique.mockResolvedValueOnce(null);

    await expect(useCase.execute(idJornada, payload)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
  });
});
