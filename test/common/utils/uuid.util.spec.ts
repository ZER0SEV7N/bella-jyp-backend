import { IdentityGenerator } from '@/common/utils/uuid.util';

describe('IdentityGenerator - UUIDv7', () => {
    afterEach(() => jest.restoreAllMocks());

    it('Debe incorporar el instante, versión y variante de UUIDv7', () => {
        // Arrange: fijar el instante sin reemplazar la aleatoriedad criptográfica.
        const ahora = 1792972800000;
        jest.spyOn(Date, 'now').mockReturnValue(ahora);
        // Act: generar un identificador.
        const id = IdentityGenerator.generateId();
        // Assert: verificar el contrato público y sus primeros 48 bits temporales.
        expect(id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
        expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(ahora);
    });

    it('Debe generar identificadores diferentes dentro del mismo milisegundo', () => {
        // Arrange: todos los identificadores compartirán la parte temporal.
        jest.spyOn(Date, 'now').mockReturnValue(1792972800000);
        // Act: generar una muestra de identificadores.
        const ids = Array.from({ length: 100 }, () =>
            IdentityGenerator.generateId()
        );
        // Assert: la parte aleatoria debe evitar colisiones en la muestra.
        expect(new Set(ids).size).toBe(100);
    });
});
