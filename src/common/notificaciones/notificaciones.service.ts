//src/common/notificaciones/notificaciones.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/common/cls/redis.constants';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { AlertaGlobal } from './gateways/notificaciones.gateway';

/**
 * Servicio de notificaciones que permite publicar alertas globales a los usuarios conectados mediante WebSocket y mantener un historial compartido por rol.
 * Su objetivo es centralizar la gestión de alertas y notificaciones en la aplicación, asegurando que los usuarios reciban información relevante en tiempo real.
 * 
 * Funcionalidades principales:
 * - Publicación de alertas globales: Permite enviar alertas a todos los usuarios conectados que tengan un rol específico.
 * - Historial compartido por rol: Mantiene un historial de las últimas 50 alertas publicadas para cada rol, con una retención máxima de 90 días.
 * - Deduplicación de alertas: Evita la publicación de alertas duplicadas mediante el uso de claves únicas y expiración en Redis.
 * - Integración con WebSocket: Emite eventos a través de WebSocket para notificar a los usuarios en tiempo real cuando se publica una nueva alerta.
 * - Persistencia en Redis: Utiliza Redis para almacenar el historial de alertas y garantizar la disponibilidad de las notificaciones incluso después de reinicios del servidor.
 * - Manejo de eventos asincrónicos: Permite la recepción y publicación de alertas de manera asincrónica, mejorando la eficiencia y la capacidad de respuesta del sistema.
 * 
 * Este servicio es esencial para mantener a los usuarios informados sobre eventos importantes en la aplicación, mejorando la experiencia del usuario y facilitando la comunicación efectiva.
 */

export type Notificacion = AlertaGlobal & { id: string; timestamp: string }; //Tipo de notificación que incluye un identificador único y una marca de tiempo para cada alerta publicada.

@Injectable()
export class NotificacionesService {
    constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        private readonly eventos: EventEmitter2
    ) {}

    /**
     * Funcion asincronica que lista las notificaciones recientes para un rol específico.
     * Recupera las últimas 50 notificaciones almacenadas en Redis para el rol proporcionado y filtra aquellas que tengan una marca de tiempo dentro de los últimos 90 días.
     * @param rol - El rol de usuario para el cual se desean listar las notificaciones.
     * @returns - Una promesa que resuelve un arreglo de objetos Notificacion, representando las notificaciones recientes para el rol especificado.
     */
    async listar(rol: string): Promise<Notificacion[]> {
        //Recupera las últimas 50 notificaciones almacenadas en Redis para el rol proporcionado.
        const valores = await this.redis.lrange(`alertas:historial:${rol}`, 0, 49);
        return valores.map((v) => JSON.parse(v) as Notificacion).filter((v) => Date.parse(v.timestamp) > Date.now() - 90 * 86400000);
    }

    /**
     * @EventListener para el evento 'alerta.global'. Este método se activa cuando se emite una alerta global en la aplicación.
     * Recibe un objeto de tipo AlertaGlobal y llama al método publicar para procesar y almacenar la alerta en Redis, así como para emitir un evento de notificación a los usuarios conectados.
     * La publicación de la alerta se realiza de manera asincrónica, lo que permite que el sistema maneje múltiples alertas simultáneamente sin bloquear la ejecución.
     * @param alerta - El objeto de tipo AlertaGlobal que contiene la información de la alerta a publicar, incluyendo título, mensaje, tipo, módulo de origen y roles de destino.
     * @returns - Una promesa que se resuelve cuando la alerta ha sido procesada y publicada correctamente.
     */
    @OnEvent('alerta.global', { async: true })
    async recibir(alerta: AlertaGlobal): Promise<void> {
        await this.publicar(alerta);
    }

    /**
     * Publica una alerta global en Redis y emite un evento de notificación a los usuarios conectados.
     * Utiliza Lua para garantizar la atomicidad de la deduplicación y la persistencia de las alertas.
     * Un reinicio del sistema no afecta el historial de alertas.
     * @param alerta - El objeto de tipo AlertaGlobal que contiene la información de la alerta a publicar.
     * @param clave - Una clave opcional para identificar la alerta en Redis.
     * @returns - Una promesa que se resuelve cuando la alerta ha sido publicada correctamente.
     */
    async publicar(alerta: AlertaGlobal, clave?: string): Promise<void> {
        //Crea un objeto Notificacion que incluye la información de la alerta, un identificador único generado y una marca de tiempo actual.
        const notificacion: Notificacion = { ...alerta, id: IdentityGenerator.generateId(), timestamp: new Date().toISOString() };
        //Itera sobre los roles de destino de la alerta, eliminando duplicados mediante el uso de un Set.
        for (const rol of new Set(alerta.roles_destino)) {
            //Evalúa un script Lua en Redis para realizar la deduplicación y persistencia de la alerta de manera atómica.
            const insertada = await this.redis.eval(
                `
                if redis.call('SET', KEYS[1], '1', 'NX', 'EX', 172800) == false then return 0 end
                redis.call('LPUSH', KEYS[2], ARGV[1])
                redis.call('LTRIM', KEYS[2], 0, 49)
                redis.call('EXPIRE', KEYS[2], 7776000)
                return 1`,
                2,
                `alertas:dedupe:${rol}:${clave ?? notificacion.id}`,
                `alertas:historial:${rol}`,
                JSON.stringify(notificacion)
            );
            if (insertada === 1) await this.eventos.emitAsync('alerta.publicada', { rol, notificacion });
        }
    }
}
