//src/common/notificaciones/use-cases/listarNotificaciones.useCase.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/common/cls/redis.constants';
import type { Notificacion } from '../notificaciones.service';

/**
 * Caso de uso encargado de consultar el historial reciente de notificaciones para un rol específico.
 * Recupera hasta 50 notificaciones desde Redis, descarta entradas corruptas de forma resiliente
 * y filtra únicamente aquellas emitidas dentro de la ventana de retención de 90 días.
 */
@Injectable()
export class ListarNotificacionesUseCase {
    private readonly logger = new Logger(ListarNotificacionesUseCase.name);
    private static readonly VENTANA_RETENCION_MS = 90 * 86_400_000;

    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

    /**
     * Lista las notificaciones vigentes para el rol indicado.
     * @param rol - Rol autenticado del usuario (ej. ADMIN, RRHH, CONTADOR).
     * @returns Arreglo de notificaciones válidas dentro de los últimos 90 días.
     */
    async execute(rol: string): Promise<Notificacion[]> {
        const valores = await this.redis.lrange(`alertas:historial:${rol}`, 0, 49);
        const limiteAntiguedad = Date.now() - ListarNotificacionesUseCase.VENTANA_RETENCION_MS;

        const notificaciones: Notificacion[] = [];
        for (const raw of valores) {
            try {
                const parsed = JSON.parse(raw) as Notificacion;
                if (parsed && typeof parsed.timestamp === 'string' && Date.parse(parsed.timestamp) > limiteAntiguedad) {
                    notificaciones.push(parsed);
                }
            } catch {
                this.logger.warn(`Entrada de notificación corrupta omitida en alertas:historial:${rol}`);
            }
        }

        return notificaciones;
    }
}
