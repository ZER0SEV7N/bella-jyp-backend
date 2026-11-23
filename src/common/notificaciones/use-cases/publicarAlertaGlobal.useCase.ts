//src/common/notificaciones/use-cases/publicarAlertaGlobal.useCase.ts
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/common/cls/redis.constants';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { AlertaGlobal } from '../gateways/notificaciones.gateway';
import type { Notificacion } from '../notificaciones.service';

/**
 * Caso de uso encargado de publicar una alerta global de forma atómica en Redis
 * y notificar en paralelo a cada sala de rol destinatario sin bloqueos secuenciales.
 */
@Injectable()
export class PublicarAlertaGlobalUseCase {
    // Define un script LUA para deduplicar y persistir la alerta en Redis de manera atómica.
    private static readonly LUA_DEDUPE_AND_PUSH = `
        if redis.call('SET', KEYS[1], '1', 'NX', 'EX', 172800) == false then return 0 end
        redis.call('LPUSH', KEYS[2], ARGV[1])
        redis.call('LTRIM', KEYS[2], 0, 49)
        redis.call('EXPIRE', KEYS[2], 7776000)
        return 1`;

    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        private readonly eventos: EventEmitter2,
    ) {}

    /**
     * Deduplica, persiste en Redis y emite el evento de transmisión por cada rol único en paralelo.
     * Evita el antipatrón de `await` secuencial dentro de un bucle (SonarQube typescript:S9382)
     * y garantiza tipado explícito `string` para evitar advertencias de interpolación (typescript:S6551).
     * @param alerta - Datos de la alerta global a publicar.
     * @param clave - Clave opcional de idempotencia/deduplicación de negocio.
     */
    async execute(alerta: AlertaGlobal, clave?: string): Promise<void> {
        // Crea un objeto de notificación que combina los datos de la alerta global con un ID único y un timestamp.
        const notificacion: Notificacion = {
            ...alerta,
            id: IdentityGenerator.generateId(),
            timestamp: new Date().toISOString(),
        };

        // Obtiene una lista de roles únicos a partir de los roles de destino de la alerta global, eliminando duplicados.
        const rolesUnicos: string[] = Array.from(new Set<string>(alerta.roles_destino as readonly string[]));
        const payloadSerializado = JSON.stringify(notificacion);
        const sufijoDedupe = clave ?? notificacion.id;

        // Publica la alerta global en Redis de manera atómica y emite un evento de notificación para cada rol único en paralelo.
        await Promise.all(
            rolesUnicos.map(async (rol: string) => {
                const insertada = await this.redis.eval(
                    PublicarAlertaGlobalUseCase.LUA_DEDUPE_AND_PUSH,
                    2,
                    `alertas:dedupe:${rol}:${sufijoDedupe}`,
                    `alertas:historial:${rol}`,
                    payloadSerializado,
                );

                if (insertada === 1) {
                    await this.eventos.emitAsync('alerta.publicada', { rol, notificacion });
                }
            }),
        );
    }
}
