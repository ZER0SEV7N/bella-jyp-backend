import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ClsModule } from 'nestjs-cls';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './common/config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/config/redis/redis.module';
import { NotificacionesModule } from './common/notificaciones/notificaciones.module';
import { AuthModule } from './modules/core/auth/auth.module';
import { AuditModule } from './modules/core/audit/audit.module';
import { UsuariosModule } from './modules/core/usuarios/usuarios.module';
import { OrganizacionModule } from './modules/RRHH/organizacion/organizacion.module';
import { TareasModule } from './modules/RRHH/tareas/tareas.module';
import { ContratoModule } from './modules/RRHH/contrato/contrato.module';
import { DatosFinancieroModule } from './modules/RRHH/datoFinanciero/datosFinanciero.module';
import { SolicitudModule } from './modules/RRHH/solicitudes/solicitud.module';
import { AsistenciaModule } from './modules/asistencia/asistencia.module';
import { AfpModule } from './modules/nomina/afp/afp.module';
import { BancosModule } from './modules/nomina/bancos/bancos.module';
import { PlanillasModule } from './modules/nomina/planillas/planillas.module';
import { IntegracionesModule } from './modules/integraciones/integraciones.module';

/**
 * Módulo Raíz de la Aplicación (`AppModule`).
 * Centraliza los módulos transversales (`ConfigModule` con `validateEnv`, `ClsModule`, `ScheduleModule`,
 * `EventEmitterModule`, `PrismaModule`, `RedisModule`, `IntegracionesModule`) sin duplicar importaciones (COM-F1, COM-F6).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    NotificacionesModule,
    AuthModule,
    AuditModule,
    UsuariosModule,
    OrganizacionModule,
    TareasModule,
    ContratoModule,
    DatosFinancieroModule,
    SolicitudModule,
    AsistenciaModule,
    AfpModule,
    BancosModule,
    PlanillasModule,
    IntegracionesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
