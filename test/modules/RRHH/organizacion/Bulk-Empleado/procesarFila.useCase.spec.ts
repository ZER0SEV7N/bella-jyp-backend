//test/modules/RRHH/organizacion/Bulk-Empleado/procesarFila.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ProcesarFilaEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/procesarFilaEmpleado.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CargaMasivaFilaDTO } from '@jyp/shared-contracts';

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
 */
describe('ProcesarFilaEmpleadoUseCase - Pruebas Unitarias Exhaustivas', () => {
  let useCase: ProcesarFilaEmpleadoUseCase;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    tipo_documento: { findFirst: jest.fn() },
    area: { findFirst: jest.fn(), create: jest.fn() },
    cargo: { findFirst: jest.fn(), create: jest.fn() },
    jornada: { findFirst: jest.fn() },
    empleados: { upsert: jest.fn() },
    regimen_pension: { findFirst: jest.fn() },
    tipo_afp: { findFirst: jest.fn() },
    bancos: { findFirst: jest.fn() },
    dato_financiero: { upsert: jest.fn() },
  };

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

    useCase = module.get<ProcesarFilaEmpleadoUseCase>(ProcesarFilaEmpleadoUseCase);
    prismaService = module.get<PrismaService>(PrismaService);

    mockPrismaService.$transaction.mockImplementation((cb) => cb(mockPrismaService));
    mockPrismaService.regimen_pension.findFirst.mockResolvedValue({ id: 'regimen-uuid-1', nombre: 'ONP' });
    mockPrismaService.bancos.findFirst.mockResolvedValue({ id: 'banco-uuid-1', nombre: 'BCP' });
    mockPrismaService.dato_financiero.upsert.mockResolvedValue({ id: 'df-uuid-1' });
  });

  afterEach(() => jest.clearAllMocks());

  describe('execute() - Happy Paths', () => {
    it('Debe procesar e insertar/actualizar (upsert) exitosamente un empleado con datos completos', async () => {
      // Arrange
      const mockFila = { ...mockFilaBase };
      mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-uuid-1', tipo_documento: 'DNI' });
      mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-uuid-1', nombre: 'Sistemas' });
      mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'cargo-uuid-1', nombre: 'Desarrollador' });
      mockPrismaService.jornada.findFirst.mockResolvedValue({ id: 'jornada-uuid-1', nombre: 'Turno Mañana' });
      mockPrismaService.empleados.upsert.mockResolvedValue({ id: 'emp-uuid-1', nro_documento: '72345678' });

      // Act
      await useCase.execute(mockFila, 'job-uuid-1');

      // Assert
      expect(prismaService.tipo_documento.findFirst).toHaveBeenCalledWith({
        where: { tipo_documento: { equals: 'DNI', mode: 'insensitive' } },
      });
      expect(prismaService.empleados.upsert).toHaveBeenCalledWith(
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
        }),
      );
      expect(mockPrismaService.dato_financiero.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { empleado_id: 'emp-uuid-1' },
          update: expect.objectContaining({
            sueldo_basico: 3500.0,
            regimen_salud: 'ESSALUD_REGULAR',
          }),
        }),
      );
    });

    it('Debe auto-crear el Área y el Cargo si no existen previamente en la base de datos', async () => {
      // Arrange
      const mockFila: CargaMasivaFilaDTO = {
        ...mockFilaBase,
        nro_documento: '78990011',
        nombre: 'Ana',
        apellido: 'Lopez',
        area: 'Nueva Area Logistica',
        cargo: 'Jefe de Almacen',
        asig_familiar: false,
      };

      mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-uuid-1' });
      mockPrismaService.area.findFirst.mockResolvedValue(null);
      mockPrismaService.area.create.mockResolvedValue({ id: 'new-area-id', nombre: 'Nueva Area Logistica' });
      mockPrismaService.cargo.findFirst.mockResolvedValue(null);
      mockPrismaService.cargo.create.mockResolvedValue({ id: 'new-cargo-id', nombre: 'Jefe de Almacen' });
      mockPrismaService.jornada.findFirst.mockResolvedValue({ id: 'jornada-uuid-1' });
      mockPrismaService.empleados.upsert.mockResolvedValue({ id: 'emp-uuid-3', nro_documento: '78990011' });

      // Act
      await useCase.execute(mockFila, 'job-uuid-3');

      // Assert
      expect(prismaService.area.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nombre: 'Nueva Area Logistica' }),
        }),
      );
      expect(prismaService.cargo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nombre: 'Jefe de Almacen', id_area: 'new-area-id' }),
        }),
      );
    });
  });

  describe('execute() - Validaciones y Excepciones', () => {
    it('Debe lanzar un error si el tipo de documento especificado no existe en la base de datos', async () => {
      // Arrange
      const mockFila: CargaMasivaFilaDTO = {
        ...mockFilaBase,
        tipo_documento: 'PTP',
        nro_documento: '99999999',
      };
      mockPrismaService.tipo_documento.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(mockFila, 'job-1')).rejects.toThrow(
        "El tipo de documento 'PTP' no existe en la base de datos.",
      );
    });

    it('Debe rechazar la fila si faltan nombre o apellido requeridos por el contrato', async () => {
      // Arrange
      const mockFila: CargaMasivaFilaDTO = {
        ...mockFilaBase,
        nombre: '' as any,
        apellido: '' as any,
      };

      // Act & Assert
      await expect(useCase.execute(mockFila, 'job-1')).rejects.toThrow(
        'La fila del trabajo job-1 requiere nombre y apellido completos.',
      );
    });

    it('Debe lanzar error si el régimen pensionario o la AFP indicada no existe en el catálogo', async () => {
      // Arrange
      const mockFilaAfp: CargaMasivaFilaDTO = {
        ...mockFilaBase,
        regimen_pension: 'AFP',
        tipo_afp: 'INTEGRA',
        cuspp: '123456INTEG1',
        tipo_comision: 'FLUJO',
        afp_fecha_filiacion: '2020-01-01',
      };
      mockPrismaService.tipo_documento.findFirst.mockResolvedValue({ id: 'doc-1' });
      mockPrismaService.area.findFirst.mockResolvedValue({ id: 'area-1' });
      mockPrismaService.cargo.findFirst.mockResolvedValue({ id: 'cargo-1' });
      mockPrismaService.jornada.findFirst.mockResolvedValue({ id: 'jornada-1' });
      mockPrismaService.empleados.upsert.mockResolvedValue({ id: 'emp-1' });
      mockPrismaService.regimen_pension.findFirst.mockResolvedValue({ id: 'reg-spp', nombre: 'SPP' });
      mockPrismaService.tipo_afp.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute(mockFilaAfp, 'job-afp')).rejects.toThrow('La AFP indicada no existe.');
    });
  });
});