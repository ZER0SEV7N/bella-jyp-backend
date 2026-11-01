import type Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificacionesService } from '@/common/notificaciones/notificaciones.service';

describe('NotificacionesService - Historial y deduplicación', () => {
    const alerta = {
        titulo: 'Pago próximo',
        mensaje: 'Revisar planilla',
        tipo: 'INFO' as const,
        modulo_origen: 'PLANILLAS',
        roles_destino: ['CONTADOR' as const, 'CONTADOR' as const],
    };

    it('Debe persistir y emitir una sola vez por rol aunque el destinatario se repita', async () => {
        // Arrange: Redis acepta la inserción atómica y el emisor está mockeado.
        const redis = {
            eval: jest.fn().mockResolvedValue(1),
            lrange: jest.fn(),
        };
        const eventos = { emitAsync: jest.fn().mockResolvedValue([]) };
        const service = new NotificacionesService(
            redis as unknown as Redis,
            eventos as unknown as EventEmitter2
        );
        // Act: publicar una alerta con clave de negocio.
        await service.publicar(alerta, 'pago:2026-10-25');
        // Assert: no duplicar el historial ni la transmisión del mismo rol.
        expect(redis.eval).toHaveBeenCalledTimes(1);
        expect(redis.eval.mock.calls[0].slice(2, 4)).toEqual([
            'alertas:dedupe:CONTADOR:pago:2026-10-25',
            'alertas:historial:CONTADOR',
        ]);
        expect(eventos.emitAsync).toHaveBeenCalledWith(
            'alerta.publicada',
            expect.objectContaining({
                rol: 'CONTADOR',
                notificacion: expect.objectContaining({
                    titulo: alerta.titulo,
                }),
            })
        );
    });

    it('Debe omitir la emisión cuando Redis identifica una alerta duplicada', async () => {
        // Arrange: la clave ya existe y el script informa que no insertó.
        const redis = { eval: jest.fn().mockResolvedValue(0) };
        const eventos = { emitAsync: jest.fn() };
        const service = new NotificacionesService(
            redis as unknown as Redis,
            eventos as unknown as EventEmitter2
        );
        // Act: repetir la misma publicación.
        await service.publicar(alerta, 'misma-clave');
        // Assert: no enviar una notificación que no se ha insertado.
        expect(eventos.emitAsync).not.toHaveBeenCalled();
    });

    it('Debe consultar únicamente el historial del rol solicitado', async () => {
        // Arrange: una notificación serializada devuelta por Redis.
        const notificacion = {
            id: 'alerta-demo',
            titulo: 'Incidencias',
            timestamp: new Date().toISOString(),
        };
        const redis = {
            lrange: jest.fn().mockResolvedValue([JSON.stringify(notificacion)]),
        };
        const service = new NotificacionesService(
            redis as unknown as Redis,
            {} as EventEmitter2
        );
        // Act: recuperar el historial de RRHH.
        const resultado = await service.listar('RRHH');
        // Assert: respetar el rol y el máximo de cincuenta entradas.
        expect(redis.lrange).toHaveBeenCalledWith(
            'alertas:historial:RRHH',
            0,
            49
        );
        expect(resultado).toEqual([notificacion]);
    });
});
