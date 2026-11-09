import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import fastifyCookie from '@fastify/cookie';
import { Rfc7807ExceptionFilter } from './common/filters/rfc7807-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptors';
import fastifyMultipart from '@fastify/multipart';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MAX_ARCHIVO_BYTES } from './common/utils/fileStorage.util';

async function bootstrap() {
  // COM-F8: trustProxy permite recuperar la IP real del cliente detrás de Docker/Nginx para auditoría
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, trustProxy: true })
  );

  // Registro de filtros globales e interceptores globales
  app.useGlobalFilters(new Rfc7807ExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // COM-F9: Recorte uniforme de espacios en orígenes CORS
  app.enableCors({
    origin: (process.env.FRONTEND_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Cookies firmadas con COOKIE_SECRET validado al arranque (COM-F1)
  await app.register(fastifyCookie as any, { secret: process.env.COOKIE_SECRET });

  // COM-F5: Límite de multipart alineado con MAX_ARCHIVO_BYTES (5 MB) de FileStorageUtil
  await app.register(fastifyMultipart as any, {
    limits: {
      fileSize: MAX_ARCHIVO_BYTES,
      files: 1,
    },
  });

  // COM-F7: Publicar Swagger únicamente fuera de producción para no exponer endpoints internos M2M
  if (process.env.NODE_ENV !== 'production') {
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
          description: 'Pega aquí el Access Token devuelto por el endpoint de Login',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/v1/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  app.enableShutdownHooks();
  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
void bootstrap();
