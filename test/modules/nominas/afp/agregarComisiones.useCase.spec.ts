/** Actualización de esta prueba: Arrange prepara datos y mocks; Act ejecuta la operación; Assert comprueba el resultado y sus efectos. Se conservan los comentarios originales. */
//test/modules/afp/agregarComisiones.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException,InternalServerErrorException,} from '@nestjs/common';
import { AgregarComisionUseCase } from '@/modules/nomina/afp/use-cases/comision/agregarComision.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

//Mockear el generador de UUID para que siempre devuelva un valor predecible
jest.mock('@/common/utils/uuid.util', () => ({
  IdentityGenerator: {
    generateId: jest.fn(() => 'uuid-nueva-comision-123'),
  },
}));

/**
 * Pruebas unitarias para el caso de uso AgregarComisionUseCase.
 * Se utilizan mocks para PrismaService para simular la interacción con la base de datos.
 * Se verifican los diferentes escenarios, incluyendo la creación exitosa de una comisión,
 * la actualización de una comisión existente y el manejo de errores como AFP no encontrada o fallos en la base de datos.
 */
describe('AgregarComisionUseCase', () => {
  let useCase: AgregarComisionUseCase;
  let mockPrisma: any;

  //Configuracion inicial antes de cada prueba
  beforeEach(async () => {
    mockPrisma = {
      tipo_afp: { findUnique: jest.fn() },
      comisiones_afp: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue({ periodo_inicio: new Date('2026-01-01') }), update: jest.fn(), create: jest.fn() },
      //Simulador de la transacción que simplemente ejecuta y devuelve las promesas en orden
      $transaction: jest.fn(async (operaciones) => typeof operaciones === 'function' ? operaciones(mockPrisma) : Promise.all(operaciones)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgregarComisionUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<AgregarComisionUseCase>(AgregarComisionUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  it('Debería crear la comisión y CERRAR la anterior en una sola transacción (SCD Tipo 2)', async () => {
    //Arrange: Payload de prueba con una comisión anterior y una nueva comisión
    const payload = {
      tipo_afp_id: 'uuid-afp-integra',
      anterior_comision: { id: 'uuid-vieja', periodo_final: '2026-07-31' },
      nueva_comision: {
        periodo_inicio: '2026-08-01',
        aporte_obligatorio: 10,
        comision_sobre_ra: 1.55,
        prima_seguro: 1.84,
        comision_mixta: 0.78,
      },
    };

    //Validar que la AFP existe
    mockPrisma.tipo_afp.findUnique.mockResolvedValue({
      id: 'uuid-afp-integra',
      nombre: 'AFP Integra',
    });

    //Generar resultados simulados para la actualización y creación de comisiones (Respuesta en cola)
    mockPrisma.comisiones_afp.update.mockResolvedValue({
      id: 'uuid-vieja',
      periodo_final: new Date('2026-07-31'),
    });
    mockPrisma.comisiones_afp.create.mockResolvedValue({
      id: 'uuid-nueva-comision-123',
      ...payload.nueva_comision,
    });

    //Act
    const result = await useCase.execute(payload as any);

    //Assert
    //Verificamos que se ejecutó la transacción
    expect(mockPrisma.$transaction).toHaveBeenCalled();

    //Verificar la cola de operaciones: Primero se cierra la comisión anterior, luego se crea la nueva
    expect(mockPrisma.comisiones_afp.update).toHaveBeenCalledWith({
      where: { id: 'uuid-vieja' },
      data: { periodo_final: expect.any(Date) },
    });
    expect(mockPrisma.comisiones_afp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        afp_id: 'uuid-afp-integra',
        periodo_inicio: expect.any(Date),
        comision_sobre_ra: 1.55,
      }),
      include: { tipo_afp: { select: { id: true, nombre: true } } },
    });

    //Verificar que el resultado final sea la nueva comisión creada
    expect(result.id).toBe('uuid-nueva-comision-123');
  });

  it('Debería crear la comisión SIN intentar cerrar nada si es el primer registro de la AFP', async () => {
    //Arrange: Mismo payload pero sin 'anterior_comision'
    const payload = {
      tipo_afp_id: 'uuid-afp-integra',
      nueva_comision: {
        periodo_inicio: '2026-08-01',
        aporte_obligatorio: 10,
        comision_sobre_ra: 1.55,
        prima_seguro: 1.84,
        comision_mixta: 0.78,
      },
    };

    //Validar que la AFP existe
    mockPrisma.tipo_afp.findUnique.mockResolvedValue({
      id: 'uuid-afp-integra',
    });
    mockPrisma.comisiones_afp.create.mockResolvedValue({
      id: 'uuid-nueva-comision-123',
    });

    //Act
    await useCase.execute(payload as any);

    //Assert
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.comisiones_afp.update).not.toHaveBeenCalled(); // No cerró nada
    expect(mockPrisma.comisiones_afp.create).toHaveBeenCalled(); // Solo creó
  });

  it('Debería lanzar NotFoundException si la AFP enviada no existe en la BD', async () => {
    // Arrange
    const payload = {
      tipo_afp_id: 'uuid-afp-fantasma',
      nueva_comision: {
        /* ... */
        // La fecha válida permite alcanzar el fallo de BD que prueba este escenario.
        periodo_inicio: '2026-08-01',
        aporte_obligatorio: 10,
        prima_seguro: 1.37,
        comision_sobre_ra: 1.55,
        comision_mixta: 0.78,
      },
    };
    mockPrisma.tipo_afp.findUnique.mockResolvedValue(null);

    //Act & Assert
    await expect(useCase.execute(payload as any)).rejects.toThrow(
      NotFoundException,
    );
    await expect(useCase.execute(payload as any)).rejects.toMatchObject({
      response: expect.objectContaining({ title: 'AFP no encontrada' }),
    });

    //Verificamos que la base de datos no se haya tocado
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('Debería lanzar InternalServerErrorException si la transacción de BD falla (Rollback)', async () => {
    //Arrange
    const payload = {
      tipo_afp_id: 'uuid-afp-integra',
      nueva_comision: {
        /* ... */
        // La fecha válida permite alcanzar el fallo de BD que prueba este escenario.
        periodo_inicio: '2026-08-01',
        aporte_obligatorio: 10,
        prima_seguro: 1.37,
        comision_sobre_ra: 1.55,
        comision_mixta: 0.78,
      },
    };
    mockPrisma.tipo_afp.findUnique.mockResolvedValue({
      id: 'uuid-afp-integra',
    });

    //Simulamos que al intentar hacer el transaction, Prisma lanza un error (Ej. Base de datos caída)
    mockPrisma.$transaction.mockRejectedValue(new Error('Connection Lost'));

    //Act & Assert
    await expect(useCase.execute(payload as any)).rejects.toThrow(
      InternalServerErrorException,
    );
    await expect(useCase.execute(payload as any)).rejects.toThrow(
      'Ocurrió un error al intentar registrar la comisión',
    );
  });
});

/** Vigencias civiles y datos que ahora exige el motor de planilla. */
describe('AgregarComisionUseCase - fechas DATE', () => {
  it('Conserva el día civil y persiste el tope de seguro y flujo mixto', async () => {
    // Arrange: registro anterior de julio y nueva vigencia de agosto, en puntos porcentuales.
    const tx = { comisiones_afp: { findUnique: jest.fn().mockResolvedValue({ periodo_inicio: new Date('2026-07-01') }), update: jest.fn(), create: jest.fn().mockImplementation(({ data }) => data) } };
    const prisma = { tipo_afp: { findUnique: jest.fn().mockResolvedValue({ id: 'afp' }) }, $transaction: jest.fn((fn) => fn(tx)) };
    const caso = new AgregarComisionUseCase(prisma as never);
    const dto = { tipo_afp_id: 'afp', anterior_comision: { id: 'anterior', periodo_final: '2026-07-31' }, nueva_comision: { periodo_inicio: '2026-08-01', aporte_obligatorio: 10, prima_seguro: 1.37, comision_sobre_ra: 1.55, comision_mixta: 0.78, comision_flujo_mixta: 0, remuneracion_maxima_asegurable: 12732.70 } };
    // Act: registrar la nueva vigencia sin transformar DATE a un instante de Lima.
    await caso.execute(dto);
    // Assert: fechas UTC civiles exactas y configuración previsional completa en la persistencia.
    expect(tx.comisiones_afp.update).toHaveBeenCalledWith({ where: { id: 'anterior' }, data: { periodo_final: new Date('2026-07-31T00:00:00Z') } });
    expect(tx.comisiones_afp.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ periodo_inicio: new Date('2026-08-01T00:00:00Z'), comision_flujo_mixta: 0, remuneracion_maxima_asegurable: 12732.70 }) }));
  });
});
