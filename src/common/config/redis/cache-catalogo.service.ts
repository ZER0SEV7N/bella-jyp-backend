//src/common/config/redis/cache-catalogo.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Servicio para manejar la caché de catálogos en Redis.
 * Proporciona métodos para obtener, establecer y eliminar datos en la caché de Redis.
 * @requires - REDIS_CLIENT inyectado para interactuar con Redis.
 */
@Injectable()
export class CacheCatalogoService {
    private readonly logger = new Logger(CacheCatalogoService.name);

    //Inyectar el cliente de Redis utilizando el token REDIS_CLIENT
    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

    /**
     * Obtiene un valor de la caché de Redis o lo establece si no existe.
     * @param key - Clave para buscar en la caché.
     * @param ttlSegundos - Tiempo de vida en segundos para el valor en caché.
     * @param fetcher - Función que se ejecuta para obtener el valor si no está en la caché.
     * @returns - Promesa que resuelve con el valor obtenido de la caché o del fetcher.
     * @throws - Lanza un error si ocurre un problema al interactuar con Redis.
     */
    async getOrSet<T>(key: string, ttlSegundos: number, fetcher: () => Promise<T>): Promise<T> {
        try{
            const cached = await this.redis.get(key);
            if(cached)
                return JSON.parse(cached) as T;
        } catch (error:any) {
            this.logger.warn(`Fallo al leer key '${key}' de Redis: ${error.message}. Continuando sin caché.`);
        }

        //Si no se encuentra en caché, ejecutar la función fetcher para obtener el valor
        const resultado = await fetcher();
        
        if(resultado !== null && resultado !== undefined){
            try{
                await this.redis.set(key, JSON.stringify(resultado), 'EX', ttlSegundos);
            } catch (error:any) {
                this.logger.warn(`No se pudo persistir key '${key}' en Redis: ${error.message}`);
            }
        }

        return resultado;
    }

    /**
     * Elimina un valor de la caché de Redis basado en una clave o patrón.
     * @param patternOrKey - Clave específica o patrón con comodines para eliminar múltiples claves.
     * @returns - Promesa que se resuelve cuando la operación de eliminación ha finalizado.
     * @throws - Lanza un error si ocurre un problema al interactuar con Redis.
     */
    async invalidate(patternOrKey: string): Promise<void> {
        try {
            //Si la clave contiene un patrón con comodines, buscar todas las claves que coincidan y eliminarlas
            if(patternOrKey.includes('*')) {
                const keys = await this.redis.keys(patternOrKey);
                if(keys.length > 0) 
                    await this.redis.del(...keys);

            } else 
                await this.redis.del(patternOrKey);
        } catch (error:any) {
            this.logger.warn(`Error al invalidar caché para '${patternOrKey}': ${error.message}`);
        }
    }
}