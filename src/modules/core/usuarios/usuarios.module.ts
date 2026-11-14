//src/modules/core/usuarios/usuarios.module.ts
import { Module } from '@nestjs/common';
import { UsuariosController } from './controller/usuarios.controller';
import { ObtenerMiPerfilUseCase } from './use-cases/obtenerMiPerfil.useCase';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { GestionUsuariosUseCase } from './use-cases/gestionarUsuarios.useCase';
import { CambiarMiPasswordUseCase } from './use-cases/cambiarMiPassword.useCase';

/**
 * Módulo de Usuarios
 * Este módulo encapsula toda la funcionalidad relacionada con los usuarios, incluyendo controladores y casos de uso.
 */
@Module({
  imports: [PrismaModule],
  controllers: [UsuariosController],
  providers: [ObtenerMiPerfilUseCase, GestionUsuariosUseCase, CambiarMiPasswordUseCase],
  exports: [ObtenerMiPerfilUseCase, GestionUsuariosUseCase, CambiarMiPasswordUseCase], // Exporta los casos de uso para que puedan ser utilizados en otros módulos si es necesario
})
export class UsuariosModule {}
