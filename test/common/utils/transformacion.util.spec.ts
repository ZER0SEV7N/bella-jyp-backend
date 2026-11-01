import {
    normalizarParaBusqueda,
    sanitizarFecha,
    sanitizarTexto,
    transformarPeriodo,
} from '@/common/utils/transformacion.util';

describe('Transformaciones comunes - Valores de entrada', () => {
    it('Debe distinguir un campo ausente, uno nulo y texto vacío', () => {
        // Arrange: entradas que representan operaciones de edición diferentes.
        const entradas = [undefined, null, '   ', '  Daniel  '];
        // Act: limpiar cada texto sin inventar contenido.
        const resultados = entradas.map(sanitizarTexto);
        // Assert: undefined conserva el campo; null permite limpiarlo.
        expect(resultados).toEqual([undefined, null, null, 'Daniel']);
    });

    it('Debe normalizar tildes para una búsqueda insensible al acento', () => {
        // Arrange: nombre con tildes y puntuación.
        const entrada = 'ÁREA: Nóminas!';
        // Act: normalizar la clave de búsqueda.
        const resultado = normalizarParaBusqueda(entrada);
        // Assert: conservar palabras y espacios, sin signos ni acentos.
        expect(resultado).toBe('area nominas');
    });

    it('Debe transformar una fecha conocida y conservar nulos y ausentes', () => {
        // Arrange: fecha civil válida para el importador.
        const fecha = '15/10/2026';
        // Act: sanitizar la entrada y calcular su periodo.
        const resultado = sanitizarFecha(fecha);
        // Assert: no convertir ausentes en fechas ficticias.
        expect(resultado).toBeInstanceOf(Date);
        expect(transformarPeriodo(resultado!)).toBe('2026-10');
        expect(sanitizarFecha(undefined)).toBeUndefined();
        expect(sanitizarFecha(null)).toBeNull();
        expect(sanitizarFecha('texto inválido')).toBeNull();
    });
});
