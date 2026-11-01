import { NotificacionesController } from '@/common/notificaciones/notificaciones.controller';
import { NotificacionesService } from '@/common/notificaciones/notificaciones.service';

describe('NotificacionesController - Historial del usuario', () => {
    it('Debe utilizar el rol autenticado y devolver el historial del servicio', async () => {
        // Arrange: el cuerpo contiene un rol que el cliente intenta imponer.
        const servicio = {
            listar: jest.fn().mockResolvedValue([{ id: 'alerta-demo' }]),
        };
        const controller = new NotificacionesController(
            servicio as unknown as NotificacionesService
        );
        const req = {
            user: { rol: 'RRHH' },
            query: { rol: 'ADMIN' },
        } as unknown as Parameters<NotificacionesController['listar']>[0];
        // Act: consultar las alertas.
        const resultado = await controller.listar(req);
        // Assert: el controlador conserva la autorización procedente del guard.
        expect(servicio.listar).toHaveBeenCalledWith('RRHH');
        expect(resultado).toEqual([{ id: 'alerta-demo' }]);
    });
});
