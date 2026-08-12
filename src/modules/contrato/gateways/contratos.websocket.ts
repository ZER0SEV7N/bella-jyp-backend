//src/modules/contrato/gateways/contratos.websocket.ts
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Gateway para manejar las notificaciones de alertas de contratos.
 * Este gateway permite a los clientes suscribirse a alertas sobre contratos próximos a expirar.
 * Cuando se detectan contratos próximos a expirar, se emite un evento a todos los clientes suscritos.
 * @namespace /ws/rrhh
 */
@Injectable()
@WebSocketGateway({ cors: true, namespace: '/ws/rrhh' })
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() //Instancia del servidor WebSocket
  server: Server;

  //Logger para registrar eventos y errores relacionados con el WebSocket
  private readonly logger = new Logger(AlertsGateway.name);

  //Estados de conexión de los clientes
  handleConnection(client: Socket) { this.logger.log(`Cliente conectado: ${client.id}`); }
  handleDisconnect(client: Socket) { this.logger.log(`Cliente desconectado: ${client.id}`); }

  //El cliente se suscribe a la sala de alertas de contratos
  @SubscribeMessage('suscribirseAlertasContratos')
  handleSubscribe(client: Socket) {
    client.join('sala-alertas-contratos');
    this.logger.log(`Cliente ${client.id} se suscribió a las alertas de contratos.`);
    return { event: 'suscripcionExitosa', data: 'Conectado a sala-alertas-contratos' };
  }

  //Escucha el evento emitido por el Cron y lo reenvía por WebSocket
  @OnEvent('contratos.expirar.alerta')
  enviarAlertaWeb(payload: { cantidad: number }) {
    this.logger.log(`Transmitiendo alerta por WebSocket: ${payload.cantidad} contratos por vencer.`);
    
    //Dispara la alerta a todos los navegadores conectados a la sala
    this.server.to('sala-alertas-contratos').emit('alertaContratosPorVencer', {
      titulo: '¡Atención RRHH!',
      mensaje: `Existen ${payload.cantidad} contratos que vencerán en los próximos 30 días.`,
      cantidad: payload.cantidad,
      timestamp: new Date().toISOString()
    });
  }
}