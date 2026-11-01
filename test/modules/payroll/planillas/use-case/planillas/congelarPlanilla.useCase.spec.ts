//test/modules/payroll/planillas/use-case/planillas/congelarPlanilla.useCase.spec.ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CongelarPlanillaUseCase } from '@/modules/payroll/planillas/use-case/planillas/congelarPlanilla.useCase';
import { prepararPlanilla } from '@/modules/payroll/planillas/helpers/preparar-planilla.helper';

jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn((p, _a, fn) => fn(p)),
  bloquearEmpleado: jest.fn(),
}));
jest.mock('@/modules/payroll/planillas/helpers/preparar-planilla.helper');

/**
 * Pruebas unitarias para CongelarPlanillaUseCase siguiendo el patrón AAA (Arrange, Act, Assert).
 */
describe('CongelarPlanillaUseCase: validación y cierre contable', () => {
  const prisma = {
    historial_planillas: { findUnique: jest.fn(), update: jest.fn() },
  };
  const pool = { calcular: jest.fn() };
  const caso = new CongelarPlanillaUseCase(prisma as never, pool as never);
  const actor = { id: 'contador-uuid', ip: '127.0.0.1' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.historial_planillas.findUnique.mockResolvedValue({
      id: 'planilla',
      empleado_id: 'empleado',
      periodo: '2026-09',
      version: 1,
      fuente_hash: 'hash',
      snapshot_calculo: {},
      neto_a_pagar: '1000',
    });
    jest.mocked(prepararPlanilla).mockResolvedValue({
      hash: 'hash',
      entrada: {},
      empresa: {
        nombreEmpresa: 'J&P PERIFERICOS SAC',
        ruc: '20545122520',
        direccion: 'Jr. Emilio Fernández 160',
      },
    } as never);
    pool.calcular.mockResolvedValue({
      version_motor: 'version',
      neto_a_pagar: '1000',
    });
    prisma.historial_planillas.update.mockResolvedValue({
      id: 'planilla',
      periodo: '2026-09',
      estado: 'CONGELADO',
      version: 2,
    });
  });

  it('congela la planilla incrementando la versión cuando las fuentes y montos concilian', async () => {
    // Arrange
    const dto = { version: 1, motivo: 'Revisado y validado por contador' };

    // Act
    const r = await caso.execute('planilla', dto, actor);

    // Assert
    expect(prisma.historial_planillas.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'planilla', version: 1, estado: 'ABIERTO' },
        data: expect.objectContaining({
          estado: 'CONGELADO',
          validado_por: actor.id,
          comentarios: dto.motivo,
          version: { increment: 1 },
        }),
      }),
    );
    expect(r.estado).toBe('CONGELADO');
  });

  it('rechaza el cierre si cambió la huella de las fuentes del cálculo', async () => {
    // Arrange
    jest.mocked(prepararPlanilla).mockResolvedValue({ hash: 'otra' } as never);

    // Act
    const r = caso.execute('planilla', { version: 1, motivo: 'Prueba de concurrencia' }, actor);

    // Assert
    await expect(r).rejects.toThrow(ConflictException);
    expect(prisma.historial_planillas.update).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si la planilla no existe y ConflictException si la versión cambió', async () => {
    // Arrange
    prisma.historial_planillas.findUnique.mockResolvedValueOnce(null);

    // Act & Assert
    await expect(caso.execute('inexistente', { version: 1, motivo: 'Motivo' }, actor)).rejects.toThrow(NotFoundException);

    // Arrange: versión distinta
    await expect(caso.execute('planilla', { version: 99, motivo: 'Motivo' }, actor)).rejects.toThrow(ConflictException);
  });

  it('rechaza si los montos recalculados no concilian o faltan datos de la empresa', async () => {
    // Arrange: monto distinto
    pool.calcular.mockResolvedValueOnce({ version_motor: 'v', neto_a_pagar: '999.99' });

    // Act & Assert
    await expect(caso.execute('planilla', { version: 1, motivo: 'Motivo' }, actor)).rejects.toThrow(ConflictException);

    // Arrange: RUC inválido en empresa
    jest.mocked(prepararPlanilla).mockResolvedValueOnce({
      hash: 'hash',
      entrada: {},
      empresa: { nombreEmpresa: 'DEMO', ruc: '123', direccion: 'Dir' },
    } as never);
    await expect(caso.execute('planilla', { version: 1, motivo: 'Motivo' }, actor)).rejects.toThrow(BadRequestException);
  });
});
