//test/modules/nominas/planillas/use-case/planillas/declararPlanilla.useCase.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeclararPlanillaUseCase } from '@/modules/nomina/planillas/use-case/planillas/declararPlanilla.useCase';

jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn(
    (p: unknown, _a: unknown, fn: (tx: unknown) => unknown) => fn(p)
  ),
  bloquearEmpleado: jest.fn(),
}));

/**
 * Pruebas unitarias de la declaración de planillas (PLA-F3, D4: sin reapertura).
 */
describe('DeclararPlanillaUseCase', () => {
  const prisma = {
    historial_planillas: { findUnique: jest.fn(), update: jest.fn() },
  };
  const caso = new DeclararPlanillaUseCase(prisma as never);
  const actor = { id: 'contador-uuid', ip: '127.0.0.1' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.historial_planillas.findUnique.mockResolvedValue({
      id: 'planilla',
      estado: 'CONGELADO',
      version: 1,
      comentarios: 'Cierre mensual validado',
    });
  });

  it('Debe declarar una planilla congelada (CONGELADO → DECLARADO)', async () => {
    // Arrange
    prisma.historial_planillas.update.mockResolvedValue({
      id: 'planilla',
      estado: 'DECLARADO',
    });

    // Act
    const resultado = await caso.execute('planilla', { version: 1 }, actor);

    // Assert
    expect(prisma.historial_planillas.update).toHaveBeenCalledWith({
      where: { id: 'planilla', version: 1, estado: 'CONGELADO' },
      data: expect.objectContaining({
        estado: 'DECLARADO',
        declarado_por: actor.id,
        declarado_en: expect.any(Date) as unknown,
        version: { increment: 1 },
      }),
    });
    expect(resultado).toEqual({ id: 'planilla', estado: 'DECLARADO' });
  });

  it('Debe conservar el motivo del congelamiento y agregar el de la declaración', async () => {
    // Arrange
    prisma.historial_planillas.update.mockResolvedValue({
      id: 'planilla',
      estado: 'DECLARADO',
    });

    // Act
    await caso.execute(
      'planilla',
      { version: 1, motivo: 'Cierre del mes de octubre' },
      actor
    );

    // Assert
    expect(prisma.historial_planillas.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          comentarios:
            'Cierre mensual validado\nDeclaración: Cierre del mes de octubre',
        }),
      })
    );
  });

  it('Debe mantener los comentarios cuando la declaración no trae motivo', async () => {
    // Arrange
    prisma.historial_planillas.update.mockResolvedValue({
      id: 'planilla',
      estado: 'DECLARADO',
    });

    // Act
    await caso.execute('planilla', { version: 1 }, actor);

    // Assert
    expect(prisma.historial_planillas.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          comentarios: 'Cierre mensual validado',
        }),
      })
    );
  });

  it('Debe rechazar una planilla que no está congelada', async () => {
    // Arrange
    prisma.historial_planillas.findUnique.mockResolvedValue({
      id: 'planilla',
      estado: 'ABIERTO',
      version: 1,
    });

    // Act & Assert
    await expect(caso.execute('planilla', { version: 1 }, actor)).rejects.toThrow(
      ConflictException
    );
    expect(prisma.historial_planillas.update).not.toHaveBeenCalled();
  });

  it('Debe rechazar una planilla ya declarada (estado terminal)', async () => {
    // Arrange
    prisma.historial_planillas.findUnique.mockResolvedValue({
      id: 'planilla',
      estado: 'DECLARADO',
      version: 2,
    });

    // Act & Assert
    await expect(caso.execute('planilla', { version: 2 }, actor)).rejects.toThrow(
      ConflictException
    );
    expect(prisma.historial_planillas.update).not.toHaveBeenCalled();
  });

  it('Debe rechazar una versión desactualizada', async () => {
    // Arrange
    prisma.historial_planillas.findUnique.mockResolvedValue({
      id: 'planilla',
      estado: 'CONGELADO',
      version: 2,
    });

    // Act & Assert
    await expect(caso.execute('planilla', { version: 1 }, actor)).rejects.toThrow(
      ConflictException
    );
    expect(prisma.historial_planillas.update).not.toHaveBeenCalled();
  });

  it('Debe lanzar NotFoundException si la planilla no existe', async () => {
    // Arrange
    prisma.historial_planillas.findUnique.mockResolvedValue(null);

    // Act & Assert
    await expect(caso.execute('planilla', { version: 1 }, actor)).rejects.toThrow(
      NotFoundException
    );
  });
});
