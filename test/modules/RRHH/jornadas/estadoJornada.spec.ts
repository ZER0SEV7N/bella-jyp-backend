import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EstadoJornadaUseCase } from '@/modules/RRHH/use-cases/jornadas/estadoJornada.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';

describe('EstadoJornadaUseCase', () => {
  let useCase: EstadoJornadaUseCase;
  let mockPrisma: any;

  //incializar modulo de tests
  beforeEach(async () => {
    mockPrisma = {
      jornada: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      empleados: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadoJornadaUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<EstadoJornadaUseCase>(EstadoJornadaUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('debe estar definido', () => {
    expect(useCase).toBeDefined();
  });

  it('debe lanzar NotFoundException si la jornada no existe', async () => {
    const idJornada = 'id-inexistente';
    mockPrisma.jornada.findUnique.mockResolvedValueOnce(null);

    await expect(useCase.desactivar(idJornada)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.empleados.count).not.toHaveBeenCalled();
    expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
  });

  it('debe lanzar NotFoundException si la jornada ya está eliminada', async () => {
    const idJornada = '11-555-99';
    mockPrisma.jornada.findUnique.mockResolvedValueOnce({
      id: idJornada,
      deleted_at: new Date('2024-01-01T00:00:00.000Z'),
      activo: false,
    });

    await expect(useCase.desactivar(idJornada)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.empleados.count).not.toHaveBeenCalled();
    expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
  });

  it('debe lanzar BadRequestException si hay empleados activos usando la jornada', async () => {
    const idJornada = '11-555-99';
    mockPrisma.jornada.findUnique.mockResolvedValueOnce({
      id: idJornada,
      deleted_at: null,
      activo: true,
    });
    mockPrisma.empleados.count.mockResolvedValueOnce(3);

    await expect(useCase.desactivar(idJornada)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.empleados.count).toHaveBeenCalledWith({
      where: { jornada_id: idJornada, activo: true, deleted_at: null },
    });
    expect(mockPrisma.jornada.update).not.toHaveBeenCalled();
  });

  it('debe desactivar la jornada correctamente cuando no hay empleados activos', async () => {
    const idJornada = '11-555-99';
    const jornadaExistente = {
      id: idJornada,
      deleted_at: null,
      activo: true,
    };
    const jornadaDesactivada = {
      ...jornadaExistente,
      activo: false,
      deleted_at: new Date(),
    };

    mockPrisma.jornada.findUnique.mockResolvedValueOnce(jornadaExistente);
    mockPrisma.empleados.count.mockResolvedValueOnce(0);
    mockPrisma.jornada.update.mockResolvedValueOnce(jornadaDesactivada);

    const result = await useCase.desactivar(idJornada);

    expect(mockPrisma.jornada.update).toHaveBeenCalledWith({
      where: { id: idJornada },
      data: { activo: false, deleted_at: expect.any(Date) },
    });
    expect(result).toEqual(jornadaDesactivada);
  });

  it('debe reactivar la jornada correctamente', async () => {
    const idJornada = '11-555-99';
    const jornadaReactivada = {
      id: idJornada,
      activo: true,
      deleted_at: null,
    };

    mockPrisma.jornada.update.mockResolvedValueOnce(jornadaReactivada);

    const result = await useCase.reactivar(idJornada);

    expect(mockPrisma.jornada.update).toHaveBeenCalledWith({
      where: { id: idJornada },
      data: { activo: true, deleted_at: null },
    });
    expect(result).toEqual(jornadaReactivada);
  });
});
