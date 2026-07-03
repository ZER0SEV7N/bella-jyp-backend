import { Module } from '@nestjs/common';
import { AuthController } from './controller/auth.controller';
import { LoginUseCase } from './use-cases/login.useCase';
import { ProvisionarUsuarioUseCase } from './use-cases/crearUsuarioInterno.useCase';
import { RecuperacionPasswordUseCases } from './use-cases/recuperacionPassword.useCases';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '@/common/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    // El secreto del Access Token se carga dinámicamente.
    // El Refresh Token usa su propio secreto inyectado en el Use Case.
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'jyp-dev-secret-key-1234',
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Registro innegociable de los Casos de Uso
    LoginUseCase,
    ProvisionarUsuarioUseCase,
    RecuperacionPasswordUseCases,
  ],
  exports: [JwtModule], // Exportado por si otros módulos requieren verificar tokens manualmente
})
export class AuthModule {}
