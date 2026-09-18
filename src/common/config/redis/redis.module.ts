//src/common/config/redis/redis.module.ts
import { Module, Global, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { CacheCatalogoService } from './cache-catalogo.service';

/**
 * Módulo global de Redis para la aplicación.
 * Configura la conexión a Redis y proporciona el cliente de Redis a través de inyección de dependencias.
 * @requires - BullModule para manejar colas de trabajo con Redis.
 * @requires - REDIS_CLIENT para inyectar el cliente de Redis en otros servicios.
 * @requires - OnModuleDestroy para cerrar la conexión a Redis al destruir el módulo.
 */
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
      defaultJobOptions: {
        attempts: 3, //Número de reintentos por defecto para los jobs
        backoff: { type: 'exponential', delay: 2000 }, //Estrategia de reintento exponencial con un retraso inicial de 2 segundos
        removeOnComplete: true, //Eliminar automáticamente los jobs completados
        removeOnFail: false //No eliminar automáticamente los jobs fallidos para permitir la depuración
      },
    }),
  ],
  providers: [{
    provide: REDIS_CLIENT,

    //Crear un cliente de Redis utilizando la configuración de entorno y manejar eventos de conexión y error
    useFactory: () => {
      //Crear un logger para registrar eventos relacionados con Redis
      const logger = new Logger('RedisClient');
      //Crear un cliente de Redis con la configuración de host, puerto y contraseña
      const client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          lazyConnect: false,
      });
      client.on('connect', () => logger.log('Conexión Cache-Aside establecida con Redis.'));
      client.on('error', (err) => logger.error(`Error en socket Redis: ${err.message}`));
      return client;
    },
  }, CacheCatalogoService
  ],
  exports: [BullModule, REDIS_CLIENT, CacheCatalogoService] //Exportar el módulo de Bull, el cliente de Redis y el servicio de caché de catálogos para que puedan ser utilizados en otros módulos de la aplicación
})

/**
 * Clase que representa el módulo de Redis en la aplicación.
 * Implementa la interfaz OnModuleDestroy para cerrar la conexión a Redis de manera ordenada al destruir el módulo.
 * @requires - REDIS_CLIENT inyectado para interactuar con Redis.
 * @requires - Logger para registrar eventos relacionados con la conexión a Redis.
 */
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  /**
   * Método que se ejecuta cuando el módulo es destruido.
   * Cierra la conexión a Redis de manera ordenada.
   * @returns - Promesa que se resuelve cuando la conexión a Redis ha sido cerrada.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Cerrando conexión de Redis en apagado ordenado...');
    await this.redisClient.quit();
  }
}