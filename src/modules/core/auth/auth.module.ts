//src/modules/core/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IntegracionesModule } from '@/modules/integraciones/integraciones.module';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { ControlIntentosService } from '@/common/guards/control-intentos.service';
import { AuthController } from './controller/auth.controller';
import { LoginUseCase } from './use-cases/login.useCase';
import { ProvisionarUsuarioUseCase } from './use-cases/provisionarUsuario.useCase';
import { RecuperacionPasswordUseCases } from './use-cases/recuperacionPassword.useCases';
import { RefrescarTokenUseCase } from './use-cases/refrescarToken.useCase';
import { LogoutUseCase } from './use-cases/logout.useCase';
import { JwtStrategy } from './strategies/jwt.strategy';
import { obtenerSecretoJwt } from './helpers/auth-token.helper';

/**
 * Módulo de Autenticación (`/api/v1/auth`).
 * Carga `JWT_ACCESS_SECRET` de forma segura sin valores por defecto en código (COM-F1)
 * y provee `ControlIntentosService` para prevención de ataques de fuerza bruta (AUTH-F2).
 */
@Module({
  imports: [
    IntegracionesModule,
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: obtenerSecretoJwt('ACCESS'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    ControlIntentosService,
    LoginUseCase,
    ProvisionarUsuarioUseCase,
    RecuperacionPasswordUseCases,
    RefrescarTokenUseCase,
    JwtStrategy,
    LogoutUseCase,
  ],
  exports: [JwtModule, JwtStrategy, ControlIntentosService],
})
export class AuthModule {}
