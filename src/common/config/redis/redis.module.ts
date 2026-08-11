//src/common/config/redis/redis.module.ts
//Módulo de configuración de Redis para la aplicación
import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

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
      },
    }),
  ],
  exports: [BullModule], //Exporta el módulo de Bull para que pueda ser utilizado en otros módulos de la aplicación
})
export class RedisModule {}
