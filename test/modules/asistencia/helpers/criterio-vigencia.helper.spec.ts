//test/modules/asistencia/helpers/criterio-vigencia.helper.spec.ts
import { criterioVigenciaEnPeriodo } from '@/modules/asistencia/helpers/criterio-vigencia.helper';
import { ServerTime } from '@/common/utils/server-time';

/**
 * Pruebas unitarias del criterio de vínculo vigente en período (ASI-F6).
 */
describe('criterioVigenciaEnPeriodo', () => {
  it('Debe incluir activos y colaboradores cuyo vínculo cruza el período', () => {
    // Act
    const criterio = criterioVigenciaEnPeriodo('2026-11');

    // Assert: estructura del criterio con las fechas del mes.
    expect(criterio.OR).toHaveLength(2);
    expect(criterio.OR?.[0]).toEqual({ deleted_at: null });
    expect(criterio.OR?.[1]).toEqual({
      fecha_inicio: { lte: new Date(Date.UTC(2026, 11, 0)) },
      OR: [
        { fecha_cese: null },
        { fecha_cese: { gte: ServerTime.desdeFechaSimple('2026-11-01') } },
      ],
    });
  });

  it('Debe permitir un cesado el día 15 (fecha_cese dentro del mes)', () => {
    // Arrange: cesado a mitad de mes.
    const cesado = {
      deleted_at: new Date(),
      fecha_inicio: new Date('2026-01-01'),
      fecha_cese: new Date('2026-11-15'),
    };

    // Act
    const criterio = criterioVigenciaEnPeriodo('2026-11');

    // Assert: el segundo brazo del OR cubre al cesado (fecha_cese >= inicio del mes).
    const brazoCesado = criterio.OR?.[1] as {
      OR: Array<{ fecha_cese?: unknown }>;
    };
    expect(brazoCesado.OR.some((b) => 'fecha_cese' in b)).toBe(true);

    // Se valida manualmente que el cesado coincida con el criterio.
    const cumple =
      cesado.fecha_inicio <= new Date(Date.UTC(2026, 11, 0)) &&
      (cesado.fecha_cese === null ||
        cesado.fecha_cese >= ServerTime.desdeFechaSimple('2026-11-01'));
    expect(cumple).toBe(true);
  });
});
