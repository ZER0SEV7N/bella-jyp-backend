import { PrismaService } from '@/common/prisma/prisma.service';
import { NotificacionesService } from '@/common/notificaciones/notificaciones.service';
import { AlertasOperativasCron } from '@/common/notificaciones/cron/alertas-operativas.cron';

describe('AlertasOperativasCron - Recordatorios diarios', () => {
    const entorno = { ...process.env };
    afterEach(() => {
        jest.useRealTimers();
        process.env = { ...entorno };
    });

    it('Debe avisar a RRHH cuando existen solicitudes pendientes dentro del plazo', async () => {
        // Arrange: fijar el calendario y simular dos solicitudes pendientes.
        jest.useFakeTimers().setSystemTime(new Date('2026-10-25T12:00:00Z'));
        const prisma = { solicitud: { count: jest.fn().mockResolvedValue(2) } };
        const notificaciones = {
            publicar: jest.fn().mockResolvedValue(undefined),
        };
        const cron = new AlertasOperativasCron(
            prisma as unknown as PrismaService,
            notificaciones as unknown as NotificacionesService
        );
        // Act: ejecutar la tarea sin esperar al reloj real del CRON.
        await cron.solicitudes();
        // Assert: el aviso utiliza una clave diaria y los roles de revisión.
        expect(notificaciones.publicar).toHaveBeenCalledWith(
            expect.objectContaining({ roles_destino: ['ADMIN', 'RRHH'] }),
            'solicitudes:2026-10-25'
        );
    });

    it('Debe evitar avisos de solicitudes cuando no existen pendientes', async () => {
        // Arrange: consulta vacía y servicio de notificaciones mockeado.
        const prisma = { solicitud: { count: jest.fn().mockResolvedValue(0) } };
        const notificaciones = { publicar: jest.fn() };
        const cron = new AlertasOperativasCron(
            prisma as unknown as PrismaService,
            notificaciones as unknown as NotificacionesService
        );
        // Act: ejecutar el recordatorio.
        await cron.solicitudes();
        // Assert: no generar ruido en el historial.
        expect(notificaciones.publicar).not.toHaveBeenCalled();
    });

    it('Debe limitar el día 31 al último día real de febrero', async () => {
        // Arrange: configurar pago el 31 y fijar la víspera del cierre de febrero.
        jest.useFakeTimers().setSystemTime(new Date('2026-02-27T12:00:00Z'));
        process.env.DIA_PAGO_PLANILLA = '31';
        process.env.DIAS_AVISO_PAGO = '3';
        const notificaciones = {
            publicar: jest.fn().mockResolvedValue(undefined),
        };
        const cron = new AlertasOperativasCron(
            {} as PrismaService,
            notificaciones as unknown as NotificacionesService
        );
        // Act: evaluar el recordatorio de pago.
        await cron.pago();
        // Assert: febrero termina el 28 y el aviso corresponde a contabilidad.
        expect(notificaciones.publicar).toHaveBeenCalledWith(
            expect.objectContaining({
                mensaje: expect.stringContaining('2026-02-28'),
                roles_destino: ['ADMIN', 'CONTADOR'],
            }),
            'pago:2026-02-27'
        );
    });
});
