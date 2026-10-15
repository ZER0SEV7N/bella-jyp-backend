//src/common/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ClsModule } from 'nestjs-cls';

/**
 * Módulo global de Prisma para la aplicación NestJS.
 * Este módulo proporciona el servicio PrismaService, que encapsula la lógica de acceso a la base de datos utilizando Prisma ORM.
 * Al ser un módulo global, PrismaService estará disponible en toda la aplicación sin necesidad de importarlo explícitamente en otros módulos.
 * Además, se importa ClsModule para permitir el uso de contexto aislado (Thread-safe) en las operaciones de base de datos, facilitando la auditoría y el seguimiento de las solicitudes.
 */
@Global()
@Module({
  imports: [ClsModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
