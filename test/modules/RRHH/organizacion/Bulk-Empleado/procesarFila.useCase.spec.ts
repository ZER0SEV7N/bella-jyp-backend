//test/modules/RRHH/organizacion/Bulk-Empleado/procesarFila.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProcesarFilaEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CargaMasivaFilaDTO } from '@jyp/shared-contracts';
import type { ContextoCatalogosCargaMasiva } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/helpers/catalogos-carga-masiva.helper';

jest.mock('@/common/utils/crypto.util', () => ({
  CryptoUtil: {
    encrypt: jest.fn((val) => `encrypted_${val}`),
    encryptOptional: jest.fn((val) => (val ? `encrypted_${val}` : null)),
    decrypt: jest.fn((val) => val?.replace('encrypted_', '') ?? null),
  },
}));

jest.mock('@/common/utils/uuid.util', () => ({
  IdentityGenerator: {
    generateId: jest.fn().mockReturnValue('mock-generated-uuid'),
  },
}));

/**
 * Pruebas unitarias para ProcesarFilaEmpleadoUseCase siguiendo el patrón AAA (Arrange, Act, Assert).
 * El caso de uso recibe un contexto con los catálogos ya resueltos; no consulta la base por fila.
 */
describe('ProcesarFilaEmpleadoUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: ProcesarFilaEmpleadoUseCase;

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    empleados: { upsert: jest.fn() },
    dato_financiero: { upsert: jest.fn() },
  };

  /**
   * Construye un contexto de catálogos completo, con claves en minúsculas tal como las consume el caso de uso.
   */
  const crearContexto = (
    overrides: Partial<ContextoCatalogosCargaMasiva> = {}
  ): ContextoCatalogosCargaMasiva =>
    ({
      tipoDocumento: new Map([
        ['dni', { id: 'doc-uuid-1', tipo_documento: 'DNI' }],
      ]),
      area: new Map([['sistemas', { id: 'area-uuid-1', nombre: 'Sistemas' }]]),
      cargo: new Map([
        [
          'area-uuid-1::desarrollador',
          { id: 'cargo-uuid-1', nombre: 'Desarrollador' },
        ],
      ]),
      jornada: new Map([['turno mañana', { id: 'jornada-uuid-1' }]]),
      regimenOnp: { id: 'regimen-uuid-1', nombre: 'ONP' },
      regimenAfp: { id: 'regimen-spp', nombre: 'SPP' },
      tipoAfp: new Map([['integra', { id: 'afp-uuid-1', nombre: 'INTEGRA' }]]),
      banco: new Map([['bcp', { id: 'banco-uuid-1', nombre: 'BCP' }]]),
      ...overrides,
    }) as unknown as ContextoCatalogosCargaMasiva;

  const mockFilaBase: CargaMasivaFilaDTO = {
    tipo_documento: 'DNI',
    nro_documento: '72345678',
    nombre: 'Carlos',
    apellido: 'Mendoza',
    sexo: 'MASCULINO',
    estado_civil: 'SOLTERO',
    fecha_nacimiento: '1995-05-15',
    nacionalidad: 'PERUANA',
    referencia_direccion: 'Frente al parque central',
    afp_fecha_filiacion: null,
    email: 'cmendoza@empresa.com',
    telefono: '987654321',
    direccion: 'Av. Las Begonias 450',
    departamento: 'LIMA',
    provincia: 'LIMA',
    distrito: 'SAN ISIDRO',
    ubigeo: '150131',
    fecha_inicio: '2026-01-15',
    asig_familiar: true,
    area: 'Sistemas',
    cargo: 'Desarrollador',
    jornada: 'Turno Mañana',
    sueldo_basico: 3500.0,
    regimen_pension: 'ONP',
    tipo_afp: null,
    cuspp: null,
    tipo_comision: null,
    banco_sueldo: 'BCP',
    tipo_cuenta_sueldo: 'SUELDO',
    nro_cuenta_sueldo: '19198765432012',
    cci_sueldo: '00219100987654320124',
    banco_cts: null,
    tipo_cuenta_cts: 'AHORROS',
    nro_cuenta_cts: null,
    cci_cts: null,
    regimen_salud: 'ESSALUD_REGULAR',
    eps_costo_adicional: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcesarFilaEmpleadoUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    useCase = module.get<ProcesarFilaEmpleadoUseCase>(
      ProcesarFilaEmpleadoUseCase
    );

    mockPrismaService.$transaction.mockImplementation((cb) =>
      cb(mockPrismaService)
    );
    mockPrismaService.dato_financiero.upsert.mockResolvedValue({
      id: 'df-uuid-1',
    });
  });

  afterEach(() => jest.clearAllMocks());

  describe('execute() - Happy Paths', () => {
    it('Debe procesar e insertar/actualizar (upsert) un empleado con datos completos desde el contexto', async () => {
      // Arrange
      const mockFila = { ...mockFilaBase };
      mockPrismaService.empleados.upsert.mockResolvedValue({
        id: 'emp-uuid-1',
        nro_documento: '72345678',
      });

      // Act
      await useCase.execute(mockFila, 'job-uuid-1', crearContexto());

      // Assert
      expect(mockPrismaService.empleados.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { nro_documento: '72345678' },
          update: expect.objectContaining({
            nombre: 'Carlos',
            apellido: 'Mendoza',
            area_id: 'area-uuid-1',
            cargo_id: 'cargo-uuid-1',
            jornada_id: 'jornada-uuid-1',
            asig_familiar: true,
            estado_sincronizacion: 'COMPLETO',
          }),
        })
      );
      expect(mockPrismaService.dato_financiero.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { empleado_id: 'emp-uuid-1' },
          update: expect.objectContaining({
            sueldo_basico: 3500.0,
            regimen_salud: 'ESSALUD_REGULAR',
          }),
        })
      );
    });

    it('Debe persistir el documento y el régimen AFP desde el contexto', async () => {
      // Arrange
      const mockFila: CargaMasivaFilaDTO = {
        ...mockFilaBase,
        regimen_pension: 'AFP',
        tipo_afp: 'INTEGRA',
        cuspp: '123456INTEG1',
        tipo_comision: 'FLUJO',
        afp_fecha_filiacion: '2020-01-01',
      };
      mockPrismaService.empleados.upsert.mockResolvedValue({
        id: 'emp-afp',
        nro_documento: '72345678',
      });

      // Act
      await useCase.execute(mockFila, 'job-afp', crearContexto());

      // Assert
      expect(mockPrismaService.dato_financiero.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            id_regimen: 'regimen-spp',
            id_tipo_afp: 'afp-uuid-1',
            tipo_comision: 'FLUJO',
          }),
        })
      );
    });
  });

  describe('execute() - Validaciones y Excepciones', () => {
    it('Debe lanzar un error si el tipo de documento no está en el contexto', async () => {
      // Arrange
      const mockFila: CargaMasivaFilaDTO = {
        ...mockFilaBase,
        tipo_documento: 'PTP',
        nro_documento: '99999999',
      };

      // Act & Assert
      await expect(
        useCase.execute(mockFila, 'job-1', crearContexto())
      ).rejects.toThrow(
        "El tipo de documento 'PTP' no existe en la base de datos."
      );
    });

    it('Debe rechazar la fila si faltan nombre o apellido requeridos por el contrato', async () => {
      // Arrange
      const mockFila: CargaMasivaFilaDTO = {
        ...mockFilaBase,
        nombre: '',
        apellido: '',
      };

      // Act & Assert
      await expect(
        useCase.execute(mockFila, 'job-1', crearContexto())
      ).rejects.toThrow(
        'La fila del trabajo job-1 requiere nombre y apellido completos.'
      );
    });

    it('Debe lanzar error si la AFP indicada no está en el contexto', async () => {
      // Arrange
      const mockFilaAfp: CargaMasivaFilaDTO = {
        ...mockFilaBase,
        regimen_pension: 'AFP',
        tipo_afp: 'PRIMA',
        cuspp: '123456PRIMA1',
        tipo_comision: 'FLUJO',
        afp_fecha_filiacion: '2020-01-01',
      };

      // Act & Assert
      await expect(
        useCase.execute(mockFilaAfp, 'job-afp', crearContexto())
      ).rejects.toThrow('La AFP indicada no existe.');
    });
  });
});
