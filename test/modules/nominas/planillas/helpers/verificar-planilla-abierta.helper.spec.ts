//test/modules/nominas/planillas/helpers/verificar-planilla-abierta.helper.spec.ts
import { ConflictException } from '@nestjs/common';
import { verificarPlanillaAbierta } from '@/modules/nomina/planillas/helpers/verificar-planilla-abierta.helper';

/**
 * Pruebas unitarias de la validación previa de planilla abierta (PLA-F7).
 * Evita que un rechazo legítimo del trigger `PLANILLA_BLOQUEADA` llegue como 500.
 */
describe('verificarPlanillaAbierta', () => {
  /**
   * Construye una transacción falsa que devuelve el estado indicado (o null si no hay planilla).
   */
  const crearTransaccion = (estado?: string) =>
    ({
      historial_planillas: {
        findUnique: jest.fn().mockResolvedValue(estado ? { estado } : null),
      },
    }) as never;

  it('permite registrar la novedad cuando todavía no existe planilla del período', async () => {
    //Arrange
    const tx = crearTransaccion();

    //Act & Assert
    await expect(
      verificarPlanillaAbierta(tx, 'empleado-1', '2026-11')
    ).resolves.toBeUndefined();
  });

  it.each(['ABIERTO', 'EN_REVISION'])(
    'permite registrar la novedad con la planilla en estado %s',
    async (estado) => {
      //Arrange
      const tx = crearTransaccion(estado);

      //Act & Assert
      await expect(
        verificarPlanillaAbierta(tx, 'empleado-1', '2026-11')
      ).resolves.toBeUndefined();
    }
  );

  it.each(['CONGELADO', 'DECLARADO'])(
    'rechaza la novedad con ConflictException cuando la planilla está %s',
    async (estado) => {
      //Arrange
      const tx = crearTransaccion(estado);

      //Act & Assert
      await expect(
        verificarPlanillaAbierta(tx, 'empleado-1', '2026-11')
      ).rejects.toThrow(ConflictException);
    }
  );

  it('consulta la planilla por colaborador y período', async () => {
    //Arrange
    const tx = crearTransaccion('ABIERTO');

    //Act
    await verificarPlanillaAbierta(tx, 'empleado-1', '2026-11');

    //Assert
    expect(
      (tx as unknown as { historial_planillas: { findUnique: jest.Mock } })
        .historial_planillas.findUnique
    ).toHaveBeenCalledWith({
      where: {
        empleado_id_periodo: { empleado_id: 'empleado-1', periodo: '2026-11' },
      },
      select: { estado: true },
    });
  });
});
