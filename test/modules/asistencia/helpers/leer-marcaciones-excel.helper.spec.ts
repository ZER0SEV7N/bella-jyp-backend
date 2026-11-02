import { leerMarcacionesExcel } from '@/modules/asistencia/helpers/leer-marcaciones-excel.helper';
import { conArchivoBiometrico } from '@/modules/asistencia/helpers/archivo-biometrico.helper';
import { CABECERAS } from '@/modules/asistencia/helpers/fila-marcacion-excel.helper';
import ExcelJS from 'exceljs';

jest.mock('@/modules/asistencia/helpers/archivo-biometrico.helper', () => ({
  conArchivoBiometrico: jest.fn(),
}));
jest.mock('exceljs', () => ({
  __esModule: true,
  default: { stream: { xlsx: { WorkbookReader: jest.fn() } } },
}));
describe('Lectura de filas del Excel biométrico', () => {
  const lector = ExcelJS.stream.xlsx.WorkbookReader as unknown as jest.Mock;
  const fila = (number: number, valores: unknown[]) => ({
    number,
    values: [undefined, ...valores],
  });
  const cabecera = () => fila(1, CABECERAS);
  const dato = (n = 2, fecha = '2026-09-15') =>
    fila(n, ['01234567', fecha, '08:00', 'ENTRADA']);
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-01T05:00:00Z'));
    jest
      .mocked(conArchivoBiometrico)
      .mockImplementation(async (_archivo, leer) =>
        leer('/temporal.xlsx', false, 'hash-simulado')
      );
    lector.mockImplementation(() => [[cabecera(), dato()]]);
  });
  afterEach(() => jest.useRealTimers());
  it('devuelve filas válidas, período y hash del archivo', async () => {
    // Arrange: una hoja con cabeceras correctas y una fila de asistencia.
    const archivo = {} as never;
    // Act: leer el libro simulado por streaming.
    const resultado = await leerMarcacionesExcel(archivo);
    // Assert: el importador recibe el origen y la fila exactos para su validación posterior.
    expect(resultado).toMatchObject({
      archivoHash: 'hash-simulado',
      periodo: '2026-09',
      errores: [],
      filas: [{ fila: 2, nro_documento: '01234567' }],
    });
  });
  it('omite filas vacías y conserva el número de las filas inválidas', async () => {
    // Arrange: una fila vacía, una inválida y una correcta en el mismo libro.
    lector.mockImplementation(() => [
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
    expect(resultado.errores).toEqual([
      { fila: 3, detalle: expect.stringContaining('texto') },
    ]);
  });
  it('limita el diagnóstico a cien errores y permite informar un libro totalmente inválido', async () => {
    // Arrange: 101 documentos numéricos, sin filas válidas.
    lector.mockImplementation(() => [
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
  ])('rechaza un libro con %s', async (_nombre, hojas, mensaje) => {
    // Arrange: una condición estructural inválida por escenario.
    lector.mockImplementation(() => hojas);
    // Act: leer el libro antes de persistir cualquier marcación.
    const resultado = leerMarcacionesExcel({} as never);
    // Assert: ofrecer un mensaje que identifica la corrección necesaria.
    await expect(resultado).rejects.toThrow(String(mensaje));
  });
});
