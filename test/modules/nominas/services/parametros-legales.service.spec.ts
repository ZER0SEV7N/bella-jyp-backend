import { ParametrosLegalesService } from '@/modules/nomina/services/parametros-legales.service';

/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ParametrosLegalesService', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };
    const prisma = { parametro_legal: { findMany: jest.fn() } },
        redis = {
            get: jest.fn(),
            set: jest.fn(),
            scan: jest.fn(),
            del: jest.fn(),
        };
    const caso = new ParametrosLegalesService(prisma as never, redis as never);
    const fecha = new Date('2026-09-01');
    beforeEach(() => jest.resetAllMocks());
    it('usa el decimal de caché sin consultar PostgreSQL', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        redis.get.mockResolvedValue('0.09');
        // Act: ejecutar una única operación del componente.
        const r = await caso.obtenerDecimal(' essalud_pct ', fecha);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r.toString()).toBe('0.09');
        expect(prisma.parametro_legal.findMany).not.toHaveBeenCalled();
    });
    it('continúa con PostgreSQL si Redis está caído', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        redis.get.mockRejectedValue(new Error('sin Redis'));
        prisma.parametro_legal.findMany.mockResolvedValue([{ valor: '0.13' }]);
        // Act: ejecutar una única operación del componente.
        const r = await caso.obtenerValor('ONP_PCT', fecha);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(r).toBe(0.13);
        expect(redis.set).toHaveBeenCalledWith(
            'payroll:config:ONP_PCT:2026-09-01',
            '0.13',
            'EX',
            86400
        );
    });
    it('rechaza vigencias superpuestas', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        redis.get.mockResolvedValue(null);
        prisma.parametro_legal.findMany.mockResolvedValue([
            { valor: '1' },
            { valor: '2' },
        ]);
        // Act: ejecutar una única operación del componente.
        const r = caso.obtenerDecimal('UIT', fecha);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        await expect(r).rejects.toThrow('superpuestas');
    });
    it('informa la falta de configuración', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        redis.get.mockResolvedValue(null);
        prisma.parametro_legal.findMany.mockResolvedValue([]);
        // Act: ejecutar una única operación del componente.
        const r = caso.obtenerDecimal('VIDA_LEY_PCT', fecha);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        await expect(r).rejects.toThrow('No existe');
    });
    it('invalida todas las páginas de caché', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        redis.scan
            .mockResolvedValueOnce(['8', ['clave1']])
            .mockResolvedValueOnce(['0', ['clave2']]);
        // Act: ejecutar una única operación del componente.
        await caso.invalidarCache(' onp_pct ');
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(redis.del.mock.calls).toEqual([['clave1'], ['clave2']]);
    });
});
