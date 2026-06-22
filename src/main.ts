import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import fastifyCookie from '@fastify/cookie'; 

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true })
  );

  //Registro de filtros globales e interceptores globales

  //Cookies seguras
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET,
  });

  // Habilitar Apagado Seguro (Graceful Shutdown)
  app.enableShutdownHooks();

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();