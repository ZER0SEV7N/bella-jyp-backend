//src/modules/usuarios/usuarios.module.ts
import { Module } from '@nestjs/common';
import { UsuariosController } from './controller/usuarios.controller';
import { ObtenerMiPerfilUseCase } from './use-cases/obtenerMiPerfil.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Módulo de Usuarios
 * Este módulo encapsula toda la funcionalidad relacionada con los usuarios, incluyendo controladores y casos de uso.
 */
@Module({
  controllers: [UsuariosController],
  providers: [ObtenerMiPerfilUseCase, PrismaService],
})
export class UsuariosModule {}
