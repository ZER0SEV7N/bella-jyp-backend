//src/common/alertas/gateways/notificaciones.gateway.ts
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayInit, OnGatewayConnection } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';
import { AutenticacionWsService } from '../autenticacion-ws.service';
import { NotificacionesService, type Notificacion } from '../notificaciones.service';

/**
 * Gateway de notificaciones que maneja las conexiones WebSocket para la transmisión de alertas globales a los usuarios autenticados.
 * Este gateway utiliza el servicio AutenticacionWsService para autenticar a los usuarios mediante tokens JWT y el servicio NotificacionesService para recuperar y transmitir las alertas.
 * Los usuarios se suscriben a salas específicas según su rol, y el gateway se encarga de enviar las notificaciones en tiempo real a los clientes conectados.
 */

export type AlertaGlobal = import('@jyp/shared-contracts').AlertaGlobalDto; //Los eventos internos indican destinatarios; el navegador nunca elige las salas.

//Define una interfaz para representar la identidad del usuario autenticado, que incluye su ID, rol y tiempo de expiración del token.
interface Identidad {
  id: string;
  rol: string;
  exp: number;
}

type SocketAutenticado = Socket & { data: { usuario: Identidad } }; //Tipo de socket que incluye información del usuario autenticado, como su ID, rol y tiempo de expiración del token.


@Injectable()
@WebSocketGateway({
    namespace: '/ws/notificaciones',
    cors: { origin: (process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173').split(',') },
})
export class NotificacionesGateway implements OnGatewayInit, OnGatewayConnection {
    @WebSocketServer() server: Server;
    constructor(
        private readonly autenticacion: AutenticacionWsService,
        private readonly notificaciones: NotificacionesService
    ) {}

    /**
     * Método que se ejecuta después de la inicialización del gateway WebSocket.
     * Configura un middleware para autenticar a los usuarios que intentan conectarse al gateway mediante tokens JWT.
     * Si la autenticación es exitosa, se almacena la información del usuario en el objeto de datos del socket; de lo contrario, se rechaza la conexión.
     * @param server - El servidor WebSocket que representa el gateway de notificaciones.
     */
    afterInit(server: Server): void {
        //Configura un middleware para autenticar a los usuarios que intentan conectarse al gateway mediante tokens JWT.
        server.use((socket, next) => {
            this.autenticacion.autenticar(socket)
                //Si la autenticación es exitosa, 
                //se almacena la información del usuario en el objeto de datos del socket; de lo contrario, se rechaza la conexión.
                .then((usuario) => {
                    socket.data.usuario = usuario;
                    next();
        
            //Si la autenticación falla, se rechaza la conexión y se envía un mensaje de error al cliente indicando que no está autorizado.
            }).catch(() => next(new Error('No autorizado. Renueve su Access Token.')));
        });
    }

    /**
     * Maneja la conexión de un cliente WebSocket autenticado al gateway de notificaciones.
     * Suscribe al cliente a las salas correspondientes según su rol y envía el historial de notificaciones recientes.
     * Si la autenticación del usuario expira o el usuario ya no es válido, se desconecta al cliente.
     * @param client - El objeto Socket que representa la conexión WebSocket del cliente autenticado.
     */
    async handleConnection(client: SocketAutenticado): Promise<void> {
        try {
            //Obtiene la información del usuario autenticado desde el objeto de datos del socket.
            const { id, rol, exp } = client.data.usuario;

            //Suscribe al cliente a las salas correspondientes según su rol y su ID de usuario para recibir notificaciones específicas.
            await client.join([`sala-${rol}`, `user-${id}`]);

            // Establece un temporizador para desconectar al cliente cuando el token de autenticación expire, 
            //asegurando que los usuarios no puedan permanecer conectados después de que su sesión haya caducado.
            const temporizador = setTimeout(() => client.disconnect(true), Math.max(0, exp * 1000 - Date.now()));

            //Desvincula el temporizador para que no bloquee la finalización del proceso si el cliente se desconecta antes de que expire el token.
            temporizador.unref();
            
            //Escucha el evento de desconexión del cliente para limpiar el temporizador y evitar fugas de memoria.
            client.once('disconnect', () => clearTimeout(temporizador));

            //Recupera el historial de notificaciones recientes para el rol del usuario y lo envía al cliente.
            const historial = await this.notificaciones.listar(rol);

            //Si el usuario sigue siendo válido y su sesión no ha expirado, envía el historial de notificaciones al cliente; de lo contrario, desconecta al cliente.
            if (await this.autenticacion.sigueVigente(id, rol)) 
                client.emit('notificacionesIniciales', historial);
            else 
                client.disconnect(true);
        } catch (error) {
            new Logger(NotificacionesGateway.name).warn('No se pudo iniciar la suscripción de alertas.');
            client.disconnect(true);
        }
    }

    /**
     * Maneja el evento de suscripción de un cliente WebSocket autenticado para identificar al usuario y confirmar que está suscrito a las notificaciones.
     * Envía un mensaje de confirmación al cliente indicando que está suscrito y proporciona la información del usuario autenticado.
     * @param client - El objeto Socket que representa la conexión WebSocket del cliente autenticado.
     * @returns - Un objeto que indica el estado de la suscripción y la información del usuario autenticado.
     */  
    @SubscribeMessage('identificarUsuario')
    handleIdentificar(client: SocketAutenticado) {
        return { status: 'suscrito', usuario: { id: client.data.usuario.id, rol: client.data.usuario.rol } };
    }

    /**
     * Maneja el evento 'alerta.publicada' emitido por el servicio de notificaciones para transmitir una nueva alerta a los clientes WebSocket suscritos.
     * Recupera los clientes conectados a la sala correspondiente al rol de destino de la alerta y emite la notificación a cada cliente.
     * Si un cliente tiene un token de autenticación expirado o ya no es válido, se desconecta del gateway.
     * @param param0 - Un objeto que contiene el rol de destino y la notificación que se va a transmitir a los clientes suscritos.
     * @returns - Una promesa que se resuelve cuando la alerta ha sido transmitida a todos los clientes suscritos.
     */
    @OnEvent('alerta.publicada', { async: true })
    async transmitir({ rol, notificacion }: { rol: string; notificacion: Notificacion }): Promise<void> {
        //Recupera los clientes conectados a la sala correspondiente al rol de destino de la alerta y emite la notificación a cada cliente.
        const clientes = await this.server.in(`sala-${rol}`).fetchSockets();
        
        //Si un cliente tiene un token de autenticación expirado o ya no es válido, se desconecta del gateway; de lo contrario, se emite la notificación al cliente.
        for (const client of clientes) {
            const usuario = client.data.usuario as Identidad;
            //Verifica si el token de autenticación del cliente ha expirado o no es válido.
            if (usuario.exp * 1000 <= Date.now() || !(await this.autenticacion.sigueVigente(usuario.id, usuario.rol))) 
                client.disconnect(true);
            
            //Si el cliente sigue siendo válido, se emite la notificación al cliente.
            else 
                client.emit('nuevaNotificacion', notificacion);
        }
    }
}
