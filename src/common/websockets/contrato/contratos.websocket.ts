// common/websocket/alerts.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({ cors: true, namespace: '/alerts' })
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AlertsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  // El cliente se suscribe a la room de contratos
  @SubscribeMessage('subscribeToContratosExpirar')
  handleSubscribe(client: Socket) {
    client.join('contratos-expirar');
    this.logger.log(`Cliente ${client.id} suscrito a contratos-expirar`);
    return { status: 'suscrito' };
  }

  // Escucha el evento emitido por el Cron y lo reenvía por WebSocket
  @OnEvent('contratos.expirar.check')
  handleContratosExpirar(payload: { cantidad: number }) {
    this.logger.log(
      `Emitiendo alerta: ${payload.cantidad} contratos por vencer`,
    );
    this.server.to('contratos-expirar').emit('contratosExpirarAlert', payload);
  }
}
