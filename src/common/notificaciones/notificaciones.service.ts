//src/common/notificaciones/notificaciones.service.ts
import { Inject, Injectable, Optional } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/common/cls/redis.constants';
import type { AlertaGlobal } from './gateways/notificaciones.gateway';
import { ListarNotificacionesUseCase } from './use-cases/listarNotificaciones.useCase';
import { PublicarAlertaGlobalUseCase } from './use-cases/publicarAlertaGlobal.useCase';

/**
 * Servicio fachada de notificaciones que coordina los casos de uso de listado y publicación de alertas globales.
 * Mantiene la interfaz pública original (`listar`, `recibir`, `publicar`) para compatibilidad con todos los módulos
 * y tareas programadas (CRON), delegando la lógica de negocio a casos de uso especializados.
 */

export type Notificacion = AlertaGlobal & { id: string; timestamp: string };

@Injectable()
export class NotificacionesService {
    private readonly listarUseCase: ListarNotificacionesUseCase;
    private readonly publicarUseCase: PublicarAlertaGlobalUseCase;

    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        private readonly eventos: EventEmitter2,
        @Optional() listarUseCase?: ListarNotificacionesUseCase,
        @Optional() publicarUseCase?: PublicarAlertaGlobalUseCase,
    ) {
        this.listarUseCase = listarUseCase ?? new ListarNotificacionesUseCase(this.redis);
        this.publicarUseCase = publicarUseCase ?? new PublicarAlertaGlobalUseCase(this.redis, this.eventos);
    }

    /**
     * Lista las notificaciones recientes para un rol específico (últimas 50 dentro de 90 días).
     * @param rol - Rol de usuario para el cual se desean listar las notificaciones.
     */
    async listar(rol: string): Promise<Notificacion[]> {
        return this.listarUseCase.execute(rol);
    }

    /**
     * Listener del evento interno 'alerta.global' que delega en el caso de uso de publicación.
     * @param alerta - Objeto de tipo AlertaGlobal a publicar.
     */
    @OnEvent('alerta.global', { async: true })
    async recibir(alerta: AlertaGlobal): Promise<void> {
        await this.publicar(alerta);
    }

    /**
     * Publica una alerta global en Redis y emite el evento de notificación en paralelo por cada rol único.
     * @param alerta - Objeto de tipo AlertaGlobal que contiene la información de la alerta a publicar.
     * @param clave - Clave opcional para deduplicación de negocio en Redis.
     */
    async publicar(alerta: AlertaGlobal, clave?: string): Promise<void> {
        await this.publicarUseCase.execute(alerta, clave);
    }
}
