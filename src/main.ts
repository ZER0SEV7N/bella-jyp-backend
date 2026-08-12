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
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

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
      files: 1,
    },
  });

  //Configuración de Swagger para documentación de la API
  const config = new DocumentBuilder()
    .setTitle('API - Planillas JYP')
    .setDescription('Documentación de la API del sistema de planillas JYP')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description:
          'Pega aquí el Access Token devuelto por el endpoint de Login',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  //Ruta para acceder a la documentación de Swagger
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, //Mantener el token de autorización en la interfaz de Swagger después de recargar la página
    },
  });

  //Habilitar Apagado Seguro (Graceful Shutdown)
  app.enableShutdownHooks();

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();
