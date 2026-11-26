import { ProcesamientoMasivoPlanillasService } from '@/modules/nomina/planillas/services/procesamiento-masivo-planilla.service';
import { ConflictException } from '@nestjs/common';

/**
 * Pruebas unitarias del orquestador de cálculo masivo (Mejora 1 / RNF-01).
 * Verifica que se procese en paralelo, que las reglas de negocio se informen por colaborador,
 * que los fallos técnicos se relancen para reintento y que las planillas validadas no se recalculen (PLA-F6).
 */
describe('ProcesamientoMasivoPlanillasService', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };

  const prisma = {
    empleados: { count: jest.fn(), findMany: jest.fn() },
    historial_planillas: { findMany: jest.fn() },
  };
  const generar = { execute: jest.fn() };
  const caso = new ProcesamientoMasivoPlanillasService(
    prisma as never,
    generar as never
  );

  const crearJob = (periodo = '2026-09') => ({
    id: 'job',
    data: { dto: { periodo }, actor },
    updateProgress: jest.fn(),
  });

  // FIRST: cada prueba parte de mocks limpios y configura su propio escenario.
  beforeEach(() => {
    jest.clearAllMocks();
    // Por defecto no hay planilla previa para ningún colaborador.
    prisma.historial_planillas.findMany.mockResolvedValue([]);
  });

  it('Debe informar una falla de negocio y continuar con el grupo', async () => {
    // Arrange: dos colaboradores; el primero se calcula y el segundo falla por regla de negocio.
    prisma.empleados.count.mockResolvedValue(2);
    prisma.empleados.findMany
      .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
      .mockResolvedValue([]);
    generar.execute
      .mockResolvedValueOnce({ id: 'p' })
      .mockRejectedValueOnce(new ConflictException('Sin incidencia aprobada'));
    const job = crearJob();

    // Act
    const resultado = await caso.procesar(job as never);

    // Assert: el lote termina PARCIAL y se intentó calcular a los dos colaboradores.
    expect(resultado.estado).toBe('PARCIAL');
    expect(generar.execute).toHaveBeenCalledTimes(2);
    expect(job.updateProgress).toHaveBeenCalled();
  });

  it('Debe relanzar los errores técnicos para que BullMQ reintente el trabajo', async () => {
    // Arrange: un colaborador cuyo cálculo falla por un error de infraestructura.
    prisma.empleados.count.mockResolvedValue(1);
    prisma.empleados.findMany.mockResolvedValue([{ id: 'a' }]);
    generar.execute.mockRejectedValue(new Error('Hilo interrumpido'));

    // Act & Assert
    await expect(caso.procesar(crearJob() as never)).rejects.toThrow(
      'Hilo interrumpido'
    );
  });

  it.each(['CONGELADO', 'DECLARADO'])(
    'Debe omitir una planilla %s sin recalcularla ni marcarla como falla (PLA-F6)',
    async (estado) => {
      // Arrange: la planilla ya fue validada en un trabajo anterior.
      prisma.empleados.count.mockResolvedValue(1);
      prisma.empleados.findMany
        .mockResolvedValueOnce([{ id: 'a' }])
        .mockResolvedValue([]);
      prisma.historial_planillas.findMany.mockResolvedValue([
        { empleado_id: 'a', estado, snapshot_calculo: null },
      ]);

      // Act
      const resultado = await caso.procesar(crearJob() as never);

      // Assert: no se recalcula, el lote termina COMPLETADO y el contador lo refleja.
      expect(generar.execute).not.toHaveBeenCalled();
      expect(resultado.estado).toBe('COMPLETADO');
      expect(resultado.omitidas_por_estado).toBe(1);
    }
  );
});
