//test/modules/RRHH/organizacion/Bulk-Empleado/catalogos-carga-masiva.helper.spec.ts
import { prepararCatalogosCargaMasiva } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/helpers/catalogos-carga-masiva.helper';
import type { PrismaService } from '@/common/prisma/prisma.service';
import type { CargaMasivaFilaDTO } from '@jyp/shared-contracts';

jest.mock('@/common/utils/uuid.util', () => ({
  IdentityGenerator: { generateId: jest.fn().mockReturnValue('mock-uuid') },
}));

/**
 * Pruebas unitarias de la resolución de catálogos de la carga masiva.
 * Verifican que se resuelvan en una sola pasada y que las áreas y cargos ausentes se creen
 * antes del procesamiento en paralelo, evitando condiciones de carrera.
 */
describe('prepararCatalogosCargaMasiva', () => {
  const fila = (
    partial: Partial<CargaMasivaFilaDTO> = {}
  ): CargaMasivaFilaDTO =>
    ({
      tipo_documento: 'DNI',
      area: 'Sistemas',
      cargo: 'Desarrollador',
      jornada: 'Turno Mañana',
      regimen_pension: 'ONP',
      banco_sueldo: 'BCP',
      banco_cts: null,
      tipo_afp: null,
      ...partial,
    }) as CargaMasivaFilaDTO;

  const prismaMock = {
    tipo_documento: { findFirst: jest.fn() },
    area: { findFirst: jest.fn(), create: jest.fn() },
    cargo: { findFirst: jest.fn(), create: jest.fn() },
    jornada: { findFirst: jest.fn() },
    regimen_pension: { findFirst: jest.fn() },
    tipo_afp: { findFirst: jest.fn() },
    bancos: { findFirst: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.tipo_documento.findFirst.mockResolvedValue({
      id: 'doc-1',
      tipo_documento: 'DNI',
    });
    prismaMock.area.findFirst.mockResolvedValue({
      id: 'area-1',
      nombre: 'Sistemas',
    });
    prismaMock.cargo.findFirst.mockResolvedValue({
      id: 'cargo-1',
      nombre: 'Desarrollador',
    });
    prismaMock.jornada.findFirst.mockResolvedValue({ id: 'jornada-1' });
    prismaMock.regimen_pension.findFirst.mockResolvedValue({
      id: 'regimen-1',
      nombre: 'ONP',
    });
    prismaMock.bancos.findFirst.mockResolvedValue({
      id: 'banco-1',
      nombre: 'BCP',
    });
  });

  it('Debe resolver los catálogos existentes en mapas indexados por nombre en minúsculas', async () => {
    // Arrange
    const registros = [fila(), fila({ area: 'Sistemas' })];

    // Act
    const contexto = await prepararCatalogosCargaMasiva(
      prismaMock as unknown as PrismaService,
      registros
    );

    // Assert: cada catálogo queda disponible por su clave normalizada.
    expect(contexto.tipoDocumento.get('dni')).toEqual({
      id: 'doc-1',
      tipo_documento: 'DNI',
    });
    expect(contexto.area.get('sistemas')).toEqual({
      id: 'area-1',
      nombre: 'Sistemas',
    });
    expect(contexto.cargo.get('area-1::desarrollador')).toEqual({
      id: 'cargo-1',
      nombre: 'Desarrollador',
    });
    expect(contexto.jornada.get('turno mañana')).toEqual({ id: 'jornada-1' });
    expect(contexto.banco.get('bcp')).toEqual({ id: 'banco-1', nombre: 'BCP' });
  });

  it('Debe crear las áreas y cargos que no existen antes de procesar las filas', async () => {
    // Arrange: área y cargo nuevos.
    prismaMock.area.findFirst.mockResolvedValue(null);
    prismaMock.area.create.mockResolvedValue({
      id: 'area-nueva',
      nombre: 'Logística',
    });
    prismaMock.cargo.findFirst.mockResolvedValue(null);
    prismaMock.cargo.create.mockResolvedValue({
      id: 'cargo-nuevo',
      nombre: 'Almacenero',
    });
    const registros = [fila({ area: 'Logística', cargo: 'Almacenero' })];

    // Act
    const contexto = await prepararCatalogosCargaMasiva(
      prismaMock as unknown as PrismaService,
      registros
    );

    // Assert: se crean una sola vez y el cargo queda asociado al área nueva.
    expect(prismaMock.area.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.cargo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nombre: 'Almacenero',
          id_area: 'area-nueva',
        }),
      })
    );
    expect(contexto.cargo.get('area-nueva::almacenero')).toEqual({
      id: 'cargo-nuevo',
      nombre: 'Almacenero',
    });
  });

  it('Debe resolver el régimen AFP/SPP y el ONP por separado', async () => {
    // Arrange
    prismaMock.regimen_pension.findFirst
      .mockResolvedValueOnce({ id: 'reg-onp', nombre: 'ONP' })
      .mockResolvedValueOnce({ id: 'reg-spp', nombre: 'SPP' });

    // Act
    const contexto = await prepararCatalogosCargaMasiva(
      prismaMock as unknown as PrismaService,
      [fila({ regimen_pension: 'ONP' })]
    );

    // Assert
    expect(contexto.regimenOnp).toEqual({ id: 'reg-onp', nombre: 'ONP' });
    expect(contexto.regimenAfp).toEqual({ id: 'reg-spp', nombre: 'SPP' });
    expect(prismaMock.regimen_pension.findFirst).toHaveBeenNthCalledWith(1, {
      where: { nombre: { in: ['ONP'], mode: 'insensitive' } },
    });
    expect(prismaMock.regimen_pension.findFirst).toHaveBeenNthCalledWith(2, {
      where: { nombre: { in: ['AFP', 'SPP'], mode: 'insensitive' } },
    });
  });
});
