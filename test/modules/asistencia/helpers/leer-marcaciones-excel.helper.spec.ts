import { leerMarcacionesExcel } from '@/modules/asistencia/helpers/leer-marcaciones-excel.helper';
import { conArchivoBiometrico } from '@/modules/asistencia/helpers/archivo-biometrico.helper';
import { CABECERAS } from '@/modules/asistencia/helpers/fila-marcacion-excel.helper';
import ExcelJS from 'exceljs';

jest.mock('@/modules/asistencia/helpers/archivo-biometrico.helper', () => ({
  conArchivoBiometrico: jest.fn(),
}));

// Mock de exceljs: se simula un Workbook no-streaming con sus hojas y filas.
jest.mock('exceljs', () => ({
  __esModule: true,
  default: { Workbook: jest.fn() },
}));

/**
 * Pruebas unitarias de la lectura del Excel biométrico.
 * Verifican la validación de cabeceras, el acotado de errores y las reglas estructurales
 * (una sola hoja, un solo período, máximo de filas) sin depender de un archivo real.
 */
describe('Lectura de filas del Excel biométrico', () => {
  const fila = (number: number, valores: unknown[]) => ({
    number,
    values: [undefined, ...valores],
  });
  const cabecera = () => fila(1, CABECERAS);
  const dato = (n = 2, fecha = '2026-09-15') =>
    fila(n, ['01234567', fecha, '08:00', 'ENTRADA']);

  /**
   * Construye el mock de Workbook a partir de las hojas (cada hoja es un arreglo de filas).
   */
  const cargarLibro = (hojas: unknown[][][]) => {
    (ExcelJS.Workbook as unknown as jest.Mock).mockImplementation(() => ({
      xlsx: { readFile: jest.fn().mockResolvedValue(undefined) },
      worksheets: hojas.map((filas) => ({
        eachRow: (cb: (f: { number: number; values: unknown[] }) => void) =>
          filas.forEach((f) => cb(f as never)),
      })),
    }));
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T05:00:00Z'));
    (conArchivoBiometrico as jest.Mock).mockImplementation(
      (
        _archivo: unknown,
        leer: (r: string, u: boolean, h: string) => Promise<unknown>
      ) => leer('/temporal.xlsx', false, 'hash-simulado')
    );
  });

  afterEach(() => jest.useRealTimers());

  it('Debe devolver filas válidas, período y hash del archivo', async () => {
    // Arrange: una hoja con cabeceras correctas y una fila de asistencia.
    cargarLibro([[cabecera(), dato()]]);

    // Act: leer el libro simulado.
    const resultado = await leerMarcacionesExcel({} as never);

    // Assert: el importador recibe el origen y la fila exactos para su validación posterior.
    expect(resultado).toMatchObject({
      archivoHash: 'hash-simulado',
      periodo: '2026-09',
      errores: [],
      filas: [{ fila: 2, nro_documento: '01234567' }],
    });
  });

  it('Debe omitir filas vacías y conservar el número de las filas inválidas', async () => {
    // Arrange: una fila vacía, una inválida y una correcta en el mismo libro.
    cargarLibro([
      [
        cabecera(),
        fila(2, [null, undefined, '', null]),
        fila(3, [123, '2026-09-15', '08:00', 'ENTRADA']),
        dato(4),
      ],
    ]);

    // Act: recopilar el diagnóstico por fila.
    const resultado = await leerMarcacionesExcel({} as never);

    // Assert: el error no oculta la fila válida ni se asigna a la fila vacía.
    expect(resultado.filas.map((f) => f.fila)).toEqual([4]);
    expect(resultado.errores).toHaveLength(1);
    expect(resultado.errores[0]).toMatchObject({ fila: 3 });
    expect(resultado.errores[0].detalle).toContain('texto');
  });

  it('Debe limitar el diagnóstico a cien errores y permitir un libro totalmente inválido', async () => {
    // Arrange: 101 documentos numéricos, sin filas válidas.
    cargarLibro([
      [
        cabecera(),
        ...Array.from({ length: 101 }, (_, i) =>
          fila(i + 2, [123, '2026-09-15', '08:00', 'ENTRADA'])
        ),
      ],
    ]);

    // Act: validar todas las filas sin construir una respuesta de tamaño ilimitado.
    const resultado = await leerMarcacionesExcel({} as never);

    // Assert: se conserva el primer error y no se inventa un período.
    expect(resultado.errores).toHaveLength(100);
    expect(resultado.periodo).toBeNull();
    expect(resultado.filas).toEqual([]);
  });

  it.each([
    ['cabeceras incorrectas', [[fila(1, ['dni'])]], 'columnas'],
    [
      'dos hojas',
      [
        [cabecera(), dato()],
        [cabecera(), dato()],
      ],
      'sola hoja',
    ],
    ['sin marcaciones', [[cabecera()]], 'no contiene'],
    ['más de 5000 filas', [[cabecera(), dato(5002)]], '5000'],
    [
      'dos períodos',
      [[cabecera(), dato(), dato(3, '2026-08-15')]],
      'solo período',
    ],
  ])('Debe rechazar un libro con %s', async (_nombre, hojas, mensaje) => {
    // Arrange: una condición estructural inválida por escenario.
    cargarLibro(hojas as unknown[][][]);

    // Act: leer el libro antes de persistir cualquier marcación.
    const resultado = leerMarcacionesExcel({} as never);

    // Assert: ofrecer un mensaje que identifica la corrección necesaria.
    await expect(resultado).rejects.toThrow(String(mensaje));
  });
});
