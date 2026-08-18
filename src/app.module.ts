import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/core/auth/auth.module';
import { RRHHModule } from './modules/RRHH/organizacion/RRHH.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/config/redis/redis.module';
import { AuditModule } from './modules/core/audit/audit.module';
import { TareasModule } from './modules/RRHH/tareas/tareas.module';
import { ContratoModule } from './modules/RRHH/contrato/contrato.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificacionesModule } from './common/alertas/notificaciones.module';
import { AfpModule } from './modules/payroll/afp/afp.module';
import { UsuariosModule } from './modules/core/usuarios/usuarios.module';
import { DatosFinancieroModule } from './modules/payroll/datoFinanciero/datosFinanciero.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    AfpModule,
    AuthModule,
    RRHHModule,
    PrismaModule,
    RedisModule,
    AuditModule,
    TareasModule,
    ContratoModule,
    NotificacionesModule,
    UsuariosModule,
    AfpModule,
    DatosFinancieroModule,
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
