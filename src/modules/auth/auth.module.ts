//src/modules/auth/auth.module.ts
//Modulo de autenticacion
//Se encarga de manejar la autenticación y autorización de usuarios internos,
//incluyendo el login, la provisión de usuarios y la recuperación de contraseña.
import { Module } from '@nestjs/common';
import { AuthController } from './controller/auth.controller';
import { LoginUseCase } from './use-cases/login.useCase';
import { ProvisionarUsuarioUseCase } from './use-cases/crearUsuarioInterno.useCase';
import { RecuperacionPasswordUseCases } from './use-cases/recuperacionPassword.useCases';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    //El secreto del Access Token se carga dinámicamente.
    //El Refresh Token usa su propio secreto inyectado en el Use Case.
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'jyp-dev-secret-key-1234',
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    ProvisionarUsuarioUseCase,
    RecuperacionPasswordUseCases,
    JwtStrategy,
  ],
  exports: [JwtModule, JwtStrategy], //Exportado por si otros módulos requieren verificar tokens manualmente
})
export class AuthModule {}
