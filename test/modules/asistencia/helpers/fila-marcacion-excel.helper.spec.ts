import {
  fechaExcel,
  horaExcel,
  validarFilaMarcacion,
} from '@/modules/asistencia/helpers/fila-marcacion-excel.helper';
import type { Row } from 'exceljs';

describe('Conversión y validación de una fila biométrica', () => {
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T05:00:00Z'))
  );
  afterEach(() => jest.useRealTimers());
  it.each([
    [1, false, '1900-01-01'],
    [59, false, '1900-02-28'],
    [61, false, '1900-03-01'],
    [0, true, '1904-01-01'],
  ])(
    'convierte la fecha serial %s con sistema 1904=%s',
    (serial, sistema, esperado) => {
      // Arrange: fechas históricas conocidas; Excel inventó el día serial 60 de 1900.
      const entrada = Number(serial);
      // Act: convertir con el sistema de fechas del libro.
      const resultado = fechaExcel(entrada, Boolean(sistema));
      // Assert: conservar la fecha civil sin desplazamiento de zona horaria.
      expect(resultado).toBe(esperado);
    }
  );
  it.each([0, -1, 60, 1.5, NaN, Infinity])(
    'rechaza el serial inválido %s del sistema 1900',
    (serial) => {
      // Arrange: valores que no representan un día real del sistema 1900.
      const convertir = () => fechaExcel(serial, false);
      // Act / Assert: no normalizar silenciosamente una fecha inválida.
      expect(convertir).toThrow();
    }
  );
  it.each([
    [0, '00:00:00'],
    [0.5, '12:00:00'],
    [86399 / 86400, '23:59:59'],
  ])('convierte la fracción %s sin perder segundos', (fraccion, esperado) => {
    // Arrange: hora Excel expresada como fracción del día.
    const entrada = Number(fraccion);
    // Act: convertir al formato que espera el contrato.
    const resultado = horaExcel(entrada);
    // Assert: validar los tres componentes, incluidos ceros iniciales.
    expect(resultado).toBe(esperado);
  });
  it.each([-0.01, 1, 2, 0.99999999, Infinity])(
    'rechaza la fracción fuera del día %s',
    (valor) => {
      // Arrange: valores fuera del rango o que redondean al día siguiente.
      const convertir = () => horaExcel(valor);
      // Act / Assert: no fabricar una hora válida a partir del dato inválido.
      expect(convertir).toThrow();
    }
  );
  it('conserva el documento textual y normaliza el tipo de marcación', () => {
    // Arrange: fila de Excel con DNI que comienza en cero y tipo en minúsculas.
    const fila = {
      number: 8,
      values: [undefined, '01234567', '2026-09-15', 0.5, ' entrada '],
    } as Row;
    // Act: validar una fila independiente, sin leer archivos ni base de datos.
    const resultado = validarFilaMarcacion(fila, false);
    // Assert: conservar su número para informar errores al usuario.
    expect(resultado).toEqual({
      fila: 8,
      nro_documento: '01234567',
      fecha: '2026-09-15',
      hora: '12:00:00',
      tipo_marcacion: 'ENTRADA',
    });
  });
  it.each([
    ['documento numérico', 12345678, '2026-09-15', '08:00', 'ENTRADA'],
    ['fecha futura', '01234567', '2026-10-02', '08:00', 'ENTRADA'],
    ['fecha inexistente', '01234567', '2026-02-30', '08:00', 'ENTRADA'],
    ['hora ausente', '01234567', '2026-09-15', undefined, 'ENTRADA'],
    ['tipo desconocido', '01234567', '2026-09-15', '08:00', 'PAUSA'],
  ])('rechaza una fila con %s', (_nombre, documento, fecha, hora, tipo) => {
    // Arrange: una sola causa de error por escenario.
    const fila = {
      number: 2,
      values: [undefined, documento, fecha, hora, tipo],
    } as Row;
    // Act / Assert: reportar el dato inválido antes de importar marcaciones.
    expect(() => validarFilaMarcacion(fila, false)).toThrow();
  });
});
