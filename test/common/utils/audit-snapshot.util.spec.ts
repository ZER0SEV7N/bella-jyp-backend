import { crearSnapshotAuditoria } from '@/common/utils/audit-snaphot.util';

describe('crearSnapshotAuditoria - Datos sensibles', () => {
    it('Debe ocultar secretos anidados sin modificar el objeto original', () => {
        // Arrange: preparar un resultado con credenciales y datos operativos.
        const original = {
            id: 'usuario',
            usuarios: [{ password_hash: 'hash', email: 'demo@example.test' }],
            accessToken: 'token',
        };
        // Act: crear la representación persistible de auditoría.
        const snapshot = crearSnapshotAuditoria(original);
        // Assert: mantener datos operativos y ocultar secretos a cualquier profundidad.
        expect(snapshot).toEqual({
            id: 'usuario',
            usuarios: [
                { password_hash: '[OCULTO]', email: 'demo@example.test' },
            ],
            accessToken: '[OCULTO]',
        });
        expect(original.usuarios[0].password_hash).toBe('hash');
    });

    it('Debe preservar fechas serializadas y valores nulos', () => {
        // Arrange: cambio de negocio con fecha y campo sin contenido.
        const fecha = new Date('2026-10-01T00:00:00Z');
        // Act: crear el snapshot.
        const snapshot = crearSnapshotAuditoria({
            fecha,
            observacion: null,
            refreshToken: 'secreto',
        });
        // Assert: obtener un objeto JSON sin referencias al original.
        expect(snapshot).toEqual({
            fecha: fecha.toISOString(),
            observacion: null,
            refreshToken: '[OCULTO]',
        });
    });
});
