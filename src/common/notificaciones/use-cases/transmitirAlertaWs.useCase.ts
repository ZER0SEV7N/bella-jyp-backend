//src/common/notificaciones/use-cases/transmitirAlertaWs.useCase.ts
import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { AutenticacionWsService } from '../autenticacion-ws.service';
import type { Notificacion } from '../notificaciones.service';

interface IdentidadSocket {
    id: string;
    rol: string;
    exp: number;
}

/**
 * Caso de uso encargado de transmitir una notificación en tiempo real a los clientes WebSocket
 * suscritos a la sala de un rol, validando en paralelo la vigencia de cada sesión.
 */
@Injectable()
export class TransmitirAlertaWsUseCase {
    constructor(private readonly autenticacion: AutenticacionWsService) {}

    /**
     * Recupera los sockets conectados a la sala del rol, verifica en paralelo (`Promise.all`)
     * que sus tokens y estados en base de datos sigan vigentes, desconecta sesiones revocadas
     * y emite la notificación a las sesiones activas.
     * @param server - Instancia del servidor Socket.IO.
     * @param payload - Rol de destino y notificación a transmitir.
     */
    async execute(server: Server, { rol, notificacion }: { rol: string; notificacion: Notificacion }): Promise<void> {
        const clientes = await server.in(`sala-${rol}`).fetchSockets();
        const ahoraMs = Date.now();

        // Valida en paralelo la vigencia de cada cliente conectado a la sala del rol.
        const clientesValidados = await Promise.all(
            clientes.map(async (client) => {
                const usuario = client.data.usuario as IdentidadSocket;
                const vigente =
                    usuario.exp * 1000 > ahoraMs &&
                    (await this.autenticacion.sigueVigente(usuario.id, usuario.rol));
                return { client, vigente };
            }),
        );

        // Desconecta clientes con sesiones revocadas y emite la notificación a los clientes válidos.
        for (const { client, vigente } of clientesValidados) {
            if (!vigente) {
                client.disconnect(true);
            } else {
                client.emit('nuevaNotificacion', notificacion);
            }
        }
    }
}
