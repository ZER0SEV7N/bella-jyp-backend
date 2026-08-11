import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CrearJornadaUseCase } from '@/modules/RRHH/use-cases/jornadas/crearJornada.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CrearJornadaDto } from '@jyp/shared-contracts';
describe('crearJornadaUseCase', () => {
  let useCase: CrearJornadaUseCase;
  let prisma: PrismaService;
  // Mock del PrismaService: solo los métodos/modelos que usa el use case
  const mockPrismaService = {
    jornada: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrearJornadaUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();
    useCase = module.get<CrearJornadaUseCase>(CrearJornadaUseCase);
    prisma = module.get<PrismaService>(PrismaService);
  });
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  //iniciar acon las pruabs unitarias
  it('debe crear jornada sin el error de duplicado', async () => {
    mockPrismaService.jornada.findFirst.mockResolvedValue(null);
    //payload
    const payload: CrearJornadaDto = {
      hora_entrada: '2020-11-08T08:00:00.000Z',
      hora_salida: '2020-11-08T17:00:00.000Z',
      nombre: 'tarde',
      activo: null,
      tolerancia_minutos: 30,
    };
    //objeto creado
    const jornadaCreada = {
      id: expect.any(String),
      nombre: payload.nombre,
      hora_entrada: new Date(payload.hora_entrada),
      hora_salida: new Date(payload.hora_salida),
      tolerancia_minutos: payload.tolerancia_minutos,
      activo: true,
    };
    //ejecutar la funcion
    mockPrismaService.jornada.create.mockResolvedValue(jornadaCreada);
    const result = await useCase.execute(payload);
    //pruebas unitarias
    expect(result).toEqual(jornadaCreada);
    expect(mockPrismaService.jornada.create).toHaveBeenCalled();
    expect(mockPrismaService.jornada.create).toHaveBeenCalledWith({
      data: {
        ...jornadaCreada,
      },
    });
    expect(mockPrismaService.jornada.findFirst).toHaveBeenCalled();
    expect(mockPrismaService.jornada.findFirst).toHaveBeenCalledWith({
      where: { nombre: payload.nombre },
    });
  });
  //lanzado de exepciones
  it('debe lanzar la ecepcion de jornada existente', async () => {
    //objeto a crear
    const jornadaExistente = {
      id: '225-552-666',
      hora_entrada: '2020-11-08T08:00:00.000Z',
      hora_salida: '2020-11-08T17:00:00.000Z',
      nombre: 'tarde',
      activo: true,
      tolerancia_minutos: 30,
    };
    const payload: CrearJornadaDto = {
      hora_entrada: '2020-11-08T08:00:00.000Z',
      hora_salida: '2020-11-08T17:00:00.000Z',
      nombre: 'tarde',
      activo: null,
      tolerancia_minutos: 30,
    };
    //simulacion de respuesta
    mockPrismaService.jornada.findFirst.mockResolvedValueOnce(jornadaExistente);
    //inicializar expect para vlaidar la ecepxion
    await expect(useCase.execute(payload)).rejects.toThrow(BadRequestException);
    expect(mockPrismaService.jornada.create).not.toHaveBeenCalled();
  });
});
