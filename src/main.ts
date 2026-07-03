import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import fastifyCookie from '@fastify/cookie';
import { Rfc7807ExceptionFilter } from './common/filters/rfc7807-exception.filter';
import { TransformResponseInterceptor } from './common/inteceptors/transform-response.interceptors';
import fastifyMultipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  //Registro de filtros globales e interceptores globales
  app.useGlobalFilters(new Rfc7807ExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  //Cookies seguras
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET,
  });

  //Registro de multipart para manejar archivos grandes
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, //50 MB
    },
  });

  // Habilitar Apagado Seguro (Graceful Shutdown)
  app.enableShutdownHooks();

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();
