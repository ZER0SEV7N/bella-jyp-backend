//src/common/alertas/notificaciones.module.ts
import { Module, Global } from '@nestjs/common';
import { NotificacionesGateway } from './gateways/notificaciones.gateway';

/**
 * Modulo de notificaciones y alertas.
 * Funciona de forma global para que cualquier modulo pueda inyectar el servicio de notificaciones.
 */
@Global() 
@Module({
  providers: [NotificacionesGateway],
  exports: [NotificacionesGateway],
})
export class NotificacionesModule {}