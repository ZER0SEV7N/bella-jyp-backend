//src/common/notificaciones/notificaciones.module.ts
import { Module, Global } from '@nestjs/common';
import { AuthModule } from '@/modules/core/auth/auth.module';
import { NotificacionesGateway } from './gateways/notificaciones.gateway';
import { AutenticacionWsService } from './autenticacion-ws.service';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesController } from './notificaciones.controller';
import { AlertasOperativasCron } from './cron/alertas-operativas.cron';

//Módulo global: recibe alertas de los dominios y proporciona transporte e historial.
@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesGateway, AutenticacionWsService, NotificacionesService, AlertasOperativasCron],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
