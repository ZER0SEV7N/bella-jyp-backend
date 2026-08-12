//src/common/alertas/gateways/notificaciones.gateway.ts
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';


//Interfaz estandarizada para todas las alertas globales que se emiten a través del WebSocket
export interface AlertaGlobal {
    titulo: string; //Título de la alerta
    mensaje: string; //Mensaje descriptivo de la alerta
    tipo: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'; //Tipo de alerta (informativa, advertencia, error o éxito)
    modulo_origen: string; //Módulo o componente que generó la alerta (Contratos, Planillas)
    roles_destino: string[]; //Roles de usuario que deberían recibir la alerta (Admin, Usuario, etc.)
}

/**
 * Gateway para manejar las conexiones WebSocket y emitir alertas globales.
 * Este gateway escucha eventos de contratos próximos a expirar y notifica a todos los clientes conectados.
 * @namespace /ws/notificaciones
*/

@Injectable()
@WebSocketGateway({ cors: true, namespace: '/ws/notificaciones' })
export class NotificacionesGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server; //Instancia del servidor WebSocket

    private readonly logger = new Logger(NotificacionesGateway.name); //Logger para registrar eventos y errores relacionados con el WebSocket

    //Manejador de eventos para cuando un cliente se conecta al WebSocket
    handleConnection(client: Socket) {this.logger.log(`Cliente conectado: ${client.id}`); }
    handleDisconnect(client: Socket) {this.logger.log(`Cliente desconectado: ${client.id}`); }

    //Al iniciar sesion el Frontend llamara al evento 'identificarUsuario' para enviar el rol del usuario y asi filtrar las alertas que le corresponden
    @SubscribeMessage('identificarUsuario')
    handleIdentificar(client: Socket, payload: { id: string; rol: string }){
        client.join(payload.rol); //Unir al cliente a una "sala" basada en su rol para filtrar alertas
        client.join(`user-${payload.id}`); //Unir al cliente a una "sala" basada en su ID de usuario para notificaciones específicas

        this.logger.log(`Cliente ${client.id} identificado como usuario con rol: ${payload.rol}`);
        return { status: 'suscrito', salas: [`sala-${payload.rol}`, `user-${payload.id}`] };
    }

    //Listener Global de Eventos Internos

    @OnEvent('alerta.global')
    manejarAlertaGlobal(payload: AlertaGlobal) {
        this.logger.log(`Transmitiendo alerta [${payload.modulo_origen}]: ${payload.titulo}`);

        payload.roles_destino.forEach(rol => {
            this.server.to(`sala-${rol}`).emit('nuevaNotificacion',{ 
                ...payload, timestamp:
                new Date().toISOString()
            }); //Emitir la alerta a todos los clientes en la sala correspondiente al rol
        });
    }
}