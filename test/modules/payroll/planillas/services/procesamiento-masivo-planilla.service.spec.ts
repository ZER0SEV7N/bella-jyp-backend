import { ProcesamientoMasivoPlanillasService } from '@/modules/payroll/planillas/services/procesamiento-masivo-planilla.service';
import { ConflictException } from '@nestjs/common';
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ProcesamientoMasivoPlanillasService', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };
    const prisma = {
            empleados: { count: jest.fn(), findMany: jest.fn() },
            historial_planillas: { findUnique: jest.fn() },
        },
        generar = { execute: jest.fn() };
    const caso = new ProcesamientoMasivoPlanillasService(
        prisma as never,
        generar as never
    );
    it('informa una falla de negocio y continúa el grupo', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        prisma.empleados.count.mockResolvedValue(2);
        prisma.empleados.findMany
            .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
            .mockResolvedValue([]);
        prisma.historial_planillas.findUnique.mockResolvedValue(null);
        generar.execute
            .mockResolvedValueOnce({ id: 'p' })
            .mockRejectedValueOnce(
                new ConflictException('Sin incidencia aprobada')
            );
        const job = {
            id: 'job',
            data: { dto: { periodo: '2026-09' }, actor },
            updateProgress: jest.fn(),
        };
        // Act: ejecutar una única operación del componente.
        const r = await caso.procesar(job as never);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r.estado).toBe('PARCIAL');
        expect(generar.execute).toHaveBeenCalledTimes(2);
        expect(job.updateProgress).toHaveBeenCalled();
    });
    it('deja que BullMQ reintente los errores técnicos', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        prisma.empleados.count.mockResolvedValue(1);
        prisma.empleados.findMany.mockResolvedValue([{ id: 'a' }]);
        prisma.historial_planillas.findUnique.mockResolvedValue(null);
        generar.execute.mockRejectedValue(new Error('Hilo interrumpido'));
        const job = {
            id: 'job',
            data: { dto: { periodo: '2026-09' }, actor },
            updateProgress: jest.fn(),
        };
        // Act: ejecutar una única operación del componente.
        const r = caso.procesar(job as never);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        await expect(r).rejects.toThrow('Hilo interrumpido');
    });
});
