import {
  importeDos,
  numeroFijo,
  textoFijo,
  tipoDocumento,
} from '@/modules/integraciones/domain/campos-formato';

describe('Campos de longitud y precisión de las exportaciones', () => {
  it.each([
    ['0', '0.00'],
    ['1.005', '1.01'],
    [12.3, '12.30'],
  ])('redondea %s a dos decimales', (valor, esperado) => {
    // Arrange: importe de prueba, incluido el límite de medio centavo.
    const entrada = valor;
    // Act: formatear sin aritmética binaria de punto flotante.
    const resultado = importeDos(entrada);
    // Assert: redondeo HALF_UP y dos posiciones decimales.
    expect(resultado).toBe(esperado);
  });
  it.each([null, undefined, {}, -1, 'NaN', 'Infinity', 'texto'])(
    'rechaza importe no representable %s',
    (valor) => {
      // Arrange: entrada ausente, no finita o negativa.
      const actuar = () => importeDos(valor);
      // Act / Assert: no sustituir por cero un error contable.
      expect(actuar).toThrow();
    }
  );
  it('rellena texto y números sin recortar contenido', () => {
    // Arrange: campos más cortos que su ancho declarado.
    const texto = 'ABC',
      numero = '123';
    // Act: completar cada tipo de campo según su alineación.
    const resultado = [textoFijo(texto, 5), numeroFijo(numero, 5)];
    // Assert: texto a la izquierda y número a la derecha, con ancho exacto.
    expect(resultado).toEqual(['ABC  ', '00123']);
  });
  it.each(['123456', '1.5', '-1', 'ABC', ''])(
    'rechaza el entero de ancho fijo %s',
    (valor) => {
      // Arrange: caracteres o longitud que el destino no admite.
      const actuar = () => numeroFijo(valor, 5);
      // Act / Assert: no truncar ni alterar identificadores.
      expect(actuar).toThrow();
    }
  );
  it('rechaza texto más largo que el campo del destino', () => {
    // Arrange: seis caracteres en un campo de cinco.
    const actuar = () => textoFijo('ABCDEF', 5);
    // Act / Assert: pedir la corrección del dato sin recortarlo silenciosamente.
    expect(actuar).toThrow();
  });
  it.each([
    ['dni', 'PLAME', '01'],
    [' carné de extranjería ', 'PLAME', '04'],
    ['CE', 'AFPNET', '1'],
    ['PASAPORTE', 'AFPNET', '4'],
    ['DNI', 'BCP', '1'],
    ['CE', 'BCP', '3'],
    ['PASAPORTE', 'BCP', '4'],
  ])('mapea %s al código propio de %s', (nombre, destino, esperado) => {
    // Arrange: cada entidad utiliza su propia tabla documental.
    const entrada = nombre;
    // Act: resolver la equivalencia del canal solicitado.
    const resultado = tipoDocumento(entrada, destino as never);
    // Assert: no reutilizar el código de otro formato.
    expect(resultado).toBe(esperado);
  });
  it('rechaza un documento sin equivalencia explícita', () => {
    // Arrange: catálogo de origen contiene un tipo aún no homologado.
    const actuar = () => tipoDocumento('OTRO', 'PLAME');
    // Act / Assert: impedir un código genérico inventado.
    expect(actuar).toThrow('equivalencia explícita');
  });
});
