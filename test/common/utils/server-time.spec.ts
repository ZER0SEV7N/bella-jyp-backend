import { ServerTime } from '@/common/utils/server-time';

/** AAA: preparar fechas controladas, ejecutar la conversión y comprobar el resultado. */
describe('ServerTime - Fechas civiles de Perú', () => {
    afterEach(() => jest.useRealTimers());

    it('Debe conservar el mes anterior en Lima durante las primeras horas UTC', () => {
        // Arrange: el reloj UTC ya está en noviembre, pero Lima todavía está en octubre.
        jest.useFakeTimers().setSystemTime(new Date('2026-11-01T03:00:00Z'));
        // Act: consultar las fechas que utilizará el negocio.
        const periodo = ServerTime.obtenerPeriodoActual;
        const fecha = ServerTime.obtenerFechaSimpleActual;
        // Assert: el corte mensual debe respetar la zona de Perú.
        expect(periodo).toBe('2026-10');
        expect(fecha.toISOString()).toBe('2026-10-31T00:00:00.000Z');
        expect(ServerTime.obtenerPeriodoAnterior).toBe('2026-09');
    });

    it('Debe calcular un febrero bisiesto y el siguiente inicio de mes', () => {
        // Arrange: periodo bisiesto conocido.
        const periodo = '2028-02';
        // Act: calcular el rango inclusivo y su límite siguiente.
        const rango = ServerTime.obtenerRangoMes(periodo);
        // Assert: el último día es 29 y el corte ocurre a medianoche de Lima.
        expect(rango.inicioMes.toISOString()).toBe('2028-02-01T05:00:00.000Z');
        expect(rango.inicioSiguienteMes.toISOString()).toBe(
            '2028-03-01T05:00:00.000Z'
        );
        expect(rango.finMes.getTime() + 1).toBe(
            rango.inicioSiguienteMes.getTime()
        );
    });

    it.each(['2026-02-29', '2026-13-01', '25/10/2026', '0001-01-01'])(
        'Debe rechazar la fecha civil inválida %s',
        (fecha) => {
            // Arrange: fecha inválida suministrada por el caso parametrizado.
            // Act: diferir la conversión para inspeccionar su excepción.
            const convertir = () => ServerTime.desdeFechaSimple(fecha);
            // Assert: una fecha inválida no debe normalizarse silenciosamente.
            expect(convertir).toThrow(RangeError);
        }
    );

    it('Debe convertir una hora local y cerrar correctamente el día', () => {
        // Arrange: último día del año en Perú.
        const fecha = '2026-12-31';
        // Act: convertir la hora y obtener el rango diario.
        const instante = ServerTime.desdeHoraPeru(fecha, '23:59:59');
        const rango = ServerTime.rangoDiaPeru(fecha);
        // Assert: el rango dura un día y la fecha de negocio sigue en diciembre.
        expect(instante.toISOString()).toBe('2027-01-01T04:59:59.000Z');
        expect(ServerTime.fechaPeru(instante)).toBe(fecha);
        expect(rango.siguiente.getTime() - rango.inicio.getTime()).toBe(
            86400000
        );
        expect(() => ServerTime.desdeHoraPeru(fecha, '24:00')).toThrow(
            RangeError
        );
    });
});
