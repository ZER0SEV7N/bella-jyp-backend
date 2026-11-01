import { PayrollProcessor } from '@/workers/calculo-masivo/payroll.processor';
describe('PayrollProcessor', () => {
    it('Entrega el job completo al servicio de procesamiento masivo', async () => {
        // Arrange: job de cola simulado, sin conectar un worker a Redis.
        const servicio = {
            procesar: jest
                .fn()
                .mockResolvedValue({ correctos: 10, fallidos: 0 }),
        };
        const processor = new PayrollProcessor(servicio as never);
        const job = {
            id: 'job',
            data: {
                dto: { periodo: '2026-09' },
                actor: { id: 'contador', ip: '127.0.0.1' },
            },
        };
        // Act: recibir el trabajo desde el adaptador de BullMQ.
        const resultado = await processor.process(job as never);
        // Assert: el servicio recibe también el actor y el ID necesarios para trazabilidad/reintentos.
        expect(servicio.procesar).toHaveBeenCalledWith(job);
        expect(resultado.correctos).toBe(10);
    });
    it('Propaga un error técnico para que BullMQ aplique su política de reintentos', async () => {
        // Arrange: dependencia con una falla técnica, diferente de un rechazo de negocio informado por empleado.
        const error = new Error('PostgreSQL desconectado');
        const processor = new PayrollProcessor({
            procesar: jest.fn().mockRejectedValue(error),
        } as never);
        // Act: procesar el trabajo fallido.
        const operacion = processor.process({ id: 'job' } as never);
        // Assert: el adaptador no transforma el fallo en un resultado completado.
        await expect(operacion).rejects.toBe(error);
    });
});
