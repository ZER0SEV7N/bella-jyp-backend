//test/workers/calculo-masivo/calculo-masivo.worker.spec.ts
import ejecutarCalculo from '@/workers/calculo-masivo/calcular-planilla.worker';
import { PayrollPoolService } from '@/workers/calculo-masivo/payroll-pool.service';
import { PayrollProcessor } from '@/workers/calculo-masivo/payroll.processor';
import { entrada } from '../../fixtures/motores.fixture';

jest.mock('piscina', () => {
  const MockPiscina = jest.fn().mockImplementation(() => ({
    run: jest.fn(),
    destroy: jest.fn(),
  }));
  return {
    __esModule: true,
    default: MockPiscina,
  };
});

/**
 * Pruebas unitarias para el worker de cálculo masivo de planillas (`Piscina` y `BullMQ`) siguiendo el patrón AAA.
 */
describe('Workers de Cálculo Masivo de Planillas (Worker, Pool y BullMQ Processor)', () => {
  it('calcular-planilla.worker: ejecuta el motor puro de planillas y retorna los importes decimales', () => {
    // Arrange
    const datosEntrada = entrada();

    // Act
    const resultado = ejecutarCalculo(datosEntrada);

    // Assert
    expect(resultado.sueldo_base).toBe('1500.0000');
    expect(resultado.neto_a_pagar).toBeDefined();
  });

  it('PayrollPoolService: delega el cálculo al pool Piscina y libera hilos en onModuleDestroy', async () => {
    // Arrange
    const pool = new PayrollPoolService();
    const runSpy = jest.spyOn((pool as any).piscina, 'run').mockResolvedValue({ neto_a_pagar: '2610.00' });
    const destroySpy = jest.spyOn((pool as any).piscina, 'destroy').mockResolvedValue(undefined);

    // Act
    const res = await pool.calcular(entrada());
    await pool.onModuleDestroy();

    // Assert
    expect(runSpy).toHaveBeenCalled();
    expect(res.neto_a_pagar).toBe('2610.00');
    expect(destroySpy).toHaveBeenCalled();
  });

  it('PayrollProcessor: delega el job de BullMQ a ProcesamientoMasivoPlanillasService', async () => {
    // Arrange
    const mockProcesamiento = { procesar: jest.fn().mockResolvedValue({ totalProcesados: 5 }) };
    const processor = new PayrollProcessor(mockProcesamiento as any);
    const job: any = { id: 'job-1', data: { periodo: '2026-03' } };

    // Act
    const res = await processor.process(job);

    // Assert
    expect(mockProcesamiento.procesar).toHaveBeenCalledWith(job);
    expect(res).toEqual({ totalProcesados: 5 });
  });
});
