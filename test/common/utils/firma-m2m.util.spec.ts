import { firmarM2M, jsonCanonicalize, verificarFirmaM2M } from '@/common/utils/firma-m2m.util';
describe('Firma M2M', () => {
    it('firma la misma estructura aunque cambie el orden de claves', () => {
        // Arrange: dos objetos JSON equivalentes.
        const a = { b: 2, a: 1 },
            b = { a: 1, b: 2 },
            key = 'clave-ficticia-de-pruebas-de-32-caracteres';
        // Act: firmar ambos mensajes.
        const f = firmarM2M(key, 'POST', '/ruta', '1', 'nonce', a),
            g = firmarM2M(key, 'POST', '/ruta', '1', 'nonce', b);
        // Assert: JSON canónico y HMAC coinciden.
        expect(jsonCanonicalize(a)).toBe('{"a":1,"b":2}');
        expect(verificarFirmaM2M(f, g)).toBe(true);
    });
    it('una ruta o cuerpo alterados no conservan la firma', () => {
        // Arrange: petición firmada para una ruta concreta.
        const key = 'clave-ficticia-de-pruebas-de-32-caracteres',
            f = firmarM2M(key, 'POST', '/ruta', '1', 'nonce', { id: 1 });
        // Act: alterar el identificador del cuerpo.
        const g = firmarM2M(key, 'POST', '/ruta', '1', 'nonce', { id: 2 });
        // Assert: rechazo sin comparar texto con igualdad vulnerable a longitud variable.
        expect(verificarFirmaM2M(f, g)).toBe(false);
        expect(verificarFirmaM2M(f, '00')).toBe(false);
    });
});
