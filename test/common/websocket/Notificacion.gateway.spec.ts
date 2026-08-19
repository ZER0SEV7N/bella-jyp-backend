//test/common/websocket/Notificacion.gateway.spec.ts
import { NotificacionesGateway, AlertaGlobal } from '@/common/alertas/gateways/notificaciones.gateway';
import { Socket, Server } from 'socket.io';

/**
 * Pruebas unitarias para el NotificacionesGateway, que maneja la comunicación en tiempo real mediante WebSockets.
 * Estas pruebas verifican la correcta suscripción de clientes a salas (rooms) y la transmisión de alertas globales.
 * Se utilizan mocks para simular el comportamiento del servidor y los sockets, permitiendo un aislamiento completo de las pruebas.
 */
describe('NotificacionesGateway - Pruebas Unitarias de WebSockets', () => {
  let gateway: NotificacionesGateway;
  let mockServer: jest.Mocked<Server>;
  let mockSocket: jest.Mocked<Socket>;

  beforeEach(() => {
    gateway = new NotificacionesGateway();

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    } as unknown as jest.Mocked<Server>;

    mockSocket = {
      id: 'socket-client-id-100',
      join: jest.fn()
    } as unknown as jest.Mocked<Socket>;

    gateway.server = mockServer;
  });

  describe('Conexión y Mapeo de Salas (Rooms)', () => {
    it('Debe registrar la conexión y desconexión de clientes sin lanzar excepciones', () => {
      //Assert
      expect(() => gateway.handleConnection(mockSocket)).not.toThrow();
      expect(() => gateway.handleDisconnect(mockSocket)).not.toThrow();
    });

    it('Debe suscribir al cliente a las salas "sala-{rol}" y "user-{id}" durante la identificación', () => {
      const payload = { id: 'usr-uuid-001', rol: 'ADMIN' };

      const response = gateway.handleIdentificar(mockSocket, payload);

      expect(mockSocket.join).toHaveBeenCalledWith('ADMIN');
      expect(mockSocket.join).toHaveBeenCalledWith('user-usr-uuid-001');
      expect(response).toEqual({
        status: 'suscrito',
        salas: ['sala-ADMIN', 'user-usr-uuid-001']
      });
    });
  });

  describe('manejarAlertaGlobal() - Transmisión de Eventos', () => {
    it('Debe transmitir la alerta en tiempo real a las salas correspondientes según los roles destino', () => {
      const alerta: AlertaGlobal = {
        titulo: 'Contratos por Vencer',
        mensaje: 'Existen 3 contratos que vencerán en los próximos 30 días.',
        tipo: 'WARNING',
        modulo_origen: 'CONTRATOS',
        roles_destino: ['ADMIN', 'RRHH']
      };

      gateway.manejarAlertaGlobal(alerta);

      expect(mockServer.to).toHaveBeenCalledWith('sala-ADMIN');
      expect(mockServer.to).toHaveBeenCalledWith('sala-RRHH');
      expect(mockServer.emit).toHaveBeenCalledWith('nuevaNotificacion',
        expect.objectContaining({
          titulo: 'Contratos por Vencer',
          tipo: 'WARNING',
          timestamp: expect.any(String)
        })
      );
    });
  });
});