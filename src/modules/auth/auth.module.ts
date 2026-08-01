//src/modules/auth/auth.module.ts
//Modulo de autenticacion
//Se encarga de manejar la autenticación y autorización de usuarios internos,
//incluyendo el login, la provisión de usuarios y la recuperación de contraseña.
import { Module } from '@nestjs/common';
import { AuthController } from './controller/auth.controller';
import { LoginUseCase } from './use-cases/login.useCase';
import { ProvisionarUsuarioUseCase } from './use-cases/crearUsuarioInterno.useCase';
import { RecuperacionPasswordUseCases } from './use-cases/recuperacionPassword.useCases';
import { RefrescarTokenUseCase } from './use-cases/refrescarToken.useCase';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    PrismaModule,
    //El secreto del Access Token se carga dinámicamente.
    //El Refresh Token usa su propio secreto inyectado en el Use Case.
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'jyp-dev-secret-key-1234',
      signOptions: { expiresIn: '15m' }, //Tiempo de expiración del Access Token
    }),
    ClsModule.forRoot({
      global: true, //Hacer que el contexto sea global para todos los módulos
      middleware: { mount: true }, //Montar el middleware para capturar la solicitud y respuesta
    }),
  ],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    ProvisionarUsuarioUseCase,
    RecuperacionPasswordUseCases,
    RefrescarTokenUseCase,
    JwtStrategy,
  ],
  exports: [JwtModule, JwtStrategy], //Exportado por si otros módulos requieren verificar tokens manualmente
})
export class AuthModule {}
