import { actorSolicitud, type SolicitudAutenticada} from '@/common/utils/actor-operacion.util';

describe('actorSolicitud - Contexto de auditoría', () => {
    it('Debe tomar la identidad autenticada y la IP de Fastify', () => {
        // Arrange: simular una petición que ya atravesó el guard de autenticación.
        const req = {
            user: { id: 'usuario-autenticado', rol: 'RRHH' },
            ip: '127.0.0.2',
            body: { usuario_id: 'suplantado' },
        } as unknown as SolicitudAutenticada;
        // Act: construir el contexto de la operación.
        const actor = actorSolicitud(req);
        // Assert: el cuerpo del cliente no puede sustituir al usuario autenticado.
        expect(actor).toEqual({ id: 'usuario-autenticado', ip: '127.0.0.2' });
        expect(actor).not.toHaveProperty('rol');
    });
});
