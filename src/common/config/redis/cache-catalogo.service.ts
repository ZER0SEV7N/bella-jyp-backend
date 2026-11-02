//src/common/config/redis/cache-catalogo.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../cls/redis.constants';

//Definición de la interfaz CacheCodec para serializar y deserializar valores en la caché.
export interface CacheCodec<T> {
  serialize(valor: T): string;
  deserialize(valor: string): T;
}

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
    async getOrSet<T>(key: string, ttlSegundos: number, fetcher: () => Promise<T>, codec?: CacheCodec<T>): Promise<T> {
        //Validar que el TTL sea un entero positivo
        if (!Number.isSafeInteger(ttlSegundos) || ttlSegundos <= 0) 
            throw new RangeError('El TTL debe ser un entero positivo.');

        //Intentar obtener el valor de la caché de Redis
        try {
            const cached = await this.redis.get(key);
            if (cached !== null) return codec ? codec.deserialize(cached) : (JSON.parse(cached) as T);
        } catch {
            this.logger.warn('No se pudo leer o decodificar la caché. Se consultará la fuente de datos.');
        }

        //Si no se encuentra en la caché, llamar a la función fetcher para obtener el valor
        const resultado = await fetcher();
        if (resultado === null || resultado === undefined) return resultado;

        //Intentar almacenar el valor en la caché de Redis
        try {
            const serialized = codec ? codec.serialize(resultado) : JSON.stringify(resultado);
            await this.redis.set(key, serialized, 'EX', ttlSegundos);
        } catch {
            this.logger.warn('No se pudo escribir en la caché. Se conserva el resultado de la fuente de datos.');
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
            //Si no hay comodines, eliminar la clave específica
            if (!patternOrKey.includes('*')) {
                await this.redis.del(patternOrKey);
                return;
            }

            //Si hay comodines, usar SCAN para encontrar y eliminar todas las claves que coincidan con el patrón
            let cursor = '0';
            do {
                const [siguienteCursor, keys] = await this.redis.scan(cursor, 'MATCH', patternOrKey, 'COUNT', 500);
                cursor = siguienteCursor;

                //COUNT es orientativo: SCAN puede devolver más de 500 claves.
                for (let inicio = 0; inicio < keys.length; inicio += 500) await this.redis.del(...keys.slice(inicio, inicio + 500));
            } while (cursor !== '0');
        } catch {
        this.logger.warn('No se pudo invalidar la caché. La aplicación debe controlar también su versión.');
        }
    }
}