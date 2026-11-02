import type Redis from 'ioredis';
import { CacheCatalogoService } from '@/common/config/redis/cache-catalogo.service';

describe('CacheCatalogoService - Fuente de datos y caché', () => {
    it('Debe devolver un acierto sin consultar otra vez la fuente', async () => {
        // Arrange: Redis ya contiene el catálogo.
        const redis = {
            get: jest.fn().mockResolvedValue('[{"id":"banco-demo"}]'),
            set: jest.fn(),
        };
        const consultar = jest.fn();
        const service = new CacheCatalogoService(redis as unknown as Redis);
        // Act: solicitar el catálogo.
        const resultado = await service.getOrSet('bancos', 60, consultar);
        // Assert: conservar el resultado y evitar la consulta redundante.
        expect(resultado).toEqual([{ id: 'banco-demo' }]);
        expect(consultar).not.toHaveBeenCalled();
    });

    it('Debe recurrir a la fuente si el contenido de Redis está corrupto', async () => {
        // Arrange: JSON inválido y fuente disponible.
        const redis = {
            get: jest.fn().mockResolvedValue('{invalido'),
            set: jest.fn().mockResolvedValue('OK'),
        };
        const consultar = jest.fn().mockResolvedValue(['BCP']);
        const service = new CacheCatalogoService(redis as unknown as Redis);
        // Act: leer el catálogo tolerando un fallo de caché.
        const resultado = await service.getOrSet('bancos', 60, consultar);
        // Assert: la fuente sigue siendo autoritativa y se repone la caché.
        expect(resultado).toEqual(['BCP']);
        expect(redis.set).toHaveBeenCalledWith('bancos', '["BCP"]', 'EX', 60);
    });

    it('Debe invalidar todas las páginas de un patrón usando SCAN', async () => {
        // Arrange: dos páginas de claves sin usar KEYS bloqueante.
        const redis = {
            scan: jest
                .fn()
                .mockResolvedValueOnce(['7', ['bancos:1']])
                .mockResolvedValueOnce(['0', ['bancos:2']]),
            del: jest.fn().mockResolvedValue(1),
        };
        const service = new CacheCatalogoService(redis as unknown as Redis);
        // Act: invalidar el catálogo por patrón.
        await service.invalidate('bancos:*');
        // Assert: consumir las dos páginas y borrar únicamente las claves encontradas.
        expect(redis.scan).toHaveBeenCalledTimes(2);
        expect(redis.del.mock.calls).toEqual([['bancos:1'], ['bancos:2']]);
    });

    it('Debe rechazar un TTL inválido antes de llamar a Redis', async () => {
        // Arrange: dependencia que no debería utilizarse.
        const redis = { get: jest.fn() };
        const service = new CacheCatalogoService(redis as unknown as Redis);
        // Act: solicitar una caché sin vigencia válida.
        const resultado = service.getOrSet('bancos', 0, jest.fn());
        // Assert: detener la configuración incorrecta.
        await expect(resultado).rejects.toThrow(RangeError);
        expect(redis.get).not.toHaveBeenCalled();
    });
});
