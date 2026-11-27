//test/modules/core/catalogos/obtenerCatalogos.useCase.spec.ts
import {
  MODALIDADES_CONTRATO,
  ObtenerCatalogosUseCase,
} from '@/modules/core/catalogos/use-cases/obtenerCatalogos.useCase';

/**
 * Pruebas unitarias del caso de uso de catálogos base (solo lectura).
 */
describe('ObtenerCatalogosUseCase', () => {
  const prisma = {
    tipo_documento: { findMany: jest.fn() },
    regimen_pension: { findMany: jest.fn() },
  };
  const useCase = new ObtenerCatalogosUseCase(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('Debe listar los tipos de documento con id y tipo_documento', async () => {
    // Arrange
    prisma.tipo_documento.findMany.mockResolvedValue([
      { id: 'doc-1', tipo_documento: 'DNI' },
    ]);

    // Act
    const resultado = await useCase.listarTiposDocumento();

    // Assert
    expect(prisma.tipo_documento.findMany).toHaveBeenCalledWith({
      orderBy: { tipo_documento: 'asc' },
      select: { id: true, tipo_documento: true },
    });
    expect(resultado).toEqual([{ id: 'doc-1', tipo_documento: 'DNI' }]);
  });

  it('Debe listar los regímenes pensionarios con id y nombre', async () => {
    // Arrange
    prisma.regimen_pension.findMany.mockResolvedValue([
      { id: 'reg-1', nombre: 'ONP' },
    ]);

    // Act
    const resultado = await useCase.listarRegimenesPension();

    // Assert
    expect(prisma.regimen_pension.findMany).toHaveBeenCalledWith({
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });
    expect(resultado).toEqual([{ id: 'reg-1', nombre: 'ONP' }]);
  });

  it('Debe devolver el catálogo estático de modalidades de contrato', async () => {
    // Act
    const resultado = await useCase.listarModalidadesContrato();

    // Assert: es el catálogo legal, sin consultar base de datos.
    expect(resultado).toBe(MODALIDADES_CONTRATO);
    expect(prisma.tipo_documento.findMany).not.toHaveBeenCalled();
    expect(prisma.regimen_pension.findMany).not.toHaveBeenCalled();
  });
});
