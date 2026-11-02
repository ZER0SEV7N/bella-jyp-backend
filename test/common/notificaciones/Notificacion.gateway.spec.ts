import { NotificacionesGateway } from '@/common/notificaciones/gateways/notificaciones.gateway';
import { AutenticacionWsService } from '@/common/notificaciones/autenticacion-ws.service';
import { NotificacionesService } from '@/common/notificaciones/notificaciones.service';

/** La identificación proviene del handshake validado; ningún payload elige salas privilegiadas. */
describe('NotificacionesGateway - autorización', () => {
  it('Devuelve la identidad establecida por el servidor', () => {
    const gateway = new NotificacionesGateway({} as AutenticacionWsService, {} as NotificacionesService);
    const socket = { data: { usuario: { id: 'usuario', rol: 'ASISTENTE', exp: 9999999999 } } };
    expect(gateway.handleIdentificar(socket as never)).toEqual({ status: 'suscrito', usuario: { id: 'usuario', rol: 'ASISTENTE' } });
  });
  it('Rechaza un handshake cuyo token no fue autorizado', async () => {
    const auth = { autenticar: jest.fn().mockRejectedValue(new Error('Token inválido')) };
    const gateway = new NotificacionesGateway(auth as unknown as AutenticacionWsService, {} as NotificacionesService);
    let middleware: (socket: unknown, next: (error?: Error) => void) => void;
    gateway.afterInit({ use: (fn: typeof middleware) => { middleware = fn; } } as never);
    const error = await new Promise<Error | undefined>(resolve => middleware({}, resolve));
    expect(error?.message).toContain('No autorizado');
  });

  it('Desconecta al usuario revocado antes de transmitir la alerta', async () => {
    const auth = { sigueVigente: jest.fn().mockResolvedValue(false) };
    const gateway = new NotificacionesGateway(auth as unknown as AutenticacionWsService, {} as NotificacionesService);
    const cliente = { data: { usuario: { id: 'usuario', rol: 'RRHH', exp: 9999999999 } }, disconnect: jest.fn(), emit: jest.fn() };
    gateway.server = { in: jest.fn().mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue([cliente]) }) } as never;
    await gateway.transmitir({ rol: 'RRHH', notificacion: { id: 'alerta', timestamp: new Date().toISOString(), titulo: 'Aviso', mensaje: 'Texto', tipo: 'INFO', modulo_origen: 'PRUEBA', roles_destino: ['RRHH'] } });
    expect(cliente.disconnect).toHaveBeenCalledWith(true);
    expect(cliente.emit).not.toHaveBeenCalled();
  });

});
