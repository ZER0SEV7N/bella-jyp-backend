import {
  cabeceraBanco,
  detalleBcp,
} from '@/modules/integraciones/domain/banco-haberes';
import {
  filaExportacion,
  configuracionExportacion,
} from '../../../fixtures/exportacion.fixture';
describe('Nuevo Telecrédito BCP', () => {
  it('escribe el abono con longitud, moneda e importe exactos', () => {
    // Arrange: abono ficticio con cuenta de ahorros BCP de 14 dígitos.
    const fila = filaExportacion(),
      config = configuracionExportacion();
    // Act: serializar un registro de abono.
    const r = detalleBcp(fila, config);
    // Assert: 195 bytes Latin1; el importe incluye punto y el control usa la cuenta sin sus tres primeros dígitos.
    expect(Buffer.byteLength(r.linea, 'latin1')).toBe(195);
    expect(r.linea.slice(173, 177)).toBe('0001');
    expect(r.linea.slice(-18)).toBe('00000000001306.20S');
    expect(r.control).toBe(BigInt(fila.cuenta!.slice(3)));
  });
  it('suma cargo y abonos en la cabecera oficial de 113 posiciones', () => {
    // Arrange: valores de control independientes y total con centavos.
    const config = configuracionExportacion();
    // Act: generar la cabecera.
    const r = cabeceraBanco(config, 2, '600.20', 1381139266n);
    // Assert: ancho, cantidad, fecha y checksum independientes de flotantes binarios.
    expect(r.length).toBe(113);
    expect(r.slice(0, 15)).toBe('100000220261030');
    expect(BigInt(r.slice(-15))).toBe(
      1381139266n + BigInt(config.cuenta_cargo!.slice(3))
    );
  });
  it('rechaza una cuenta mal formada en vez de truncarla', () => {
    // Arrange: cuenta ficticia más larga que el campo de ahorros.
    const fila = { ...filaExportacion(), cuenta: '123456789012345' };
    // Act: intentar serializarla.
    const operar = () => detalleBcp(fila, configuracionExportacion());
    // Assert: el archivo inválido no se presenta como exitoso.
    expect(operar).toThrow('14 dígitos');
  });
  it('no infiere el tipo de cuenta a partir de SUELDO', () => {
    // Arrange: configuración sin el tipo bancario por persona.
    const config = {
      ...configuracionExportacion(),
      tipos_cuenta_abono: undefined,
    };
    // Act: intentar generar el abono.
    const operar = () => detalleBcp(filaExportacion(), config);
    // Assert: se exige la clasificación explícita.
    expect(operar).toThrow('tipo de cuenta');
  });
});

describe('BCP: cuentas, controles y límites de registros', () => {
  it.each([
    ['A', 14, '00000000000002'],
    ['C', 13, '0000000000002'],
    ['M', 13, '0000000000002'],
    ['B', 20, '00000000000000000002'],
  ])('usa el ancho específico de la cuenta %s', (tipo, longitud, cuenta) => {
    // Arrange: el tipo B utiliza CCI; los demás utilizan la cuenta local.
    const fila = {
      ...filaExportacion(),
      cuenta: String(cuenta),
      cci: String(cuenta),
    };
    const config = {
      ...configuracionExportacion(),
      tipos_cuenta_abono: { [fila.empleado_id]: tipo },
    } as never;
    // Act: generar el detalle de abono del trabajador.
    const resultado = detalleBcp(fila, config);
    // Assert: la cuenta y el control no pierden ceros iniciales ni usan otro ancho.
    expect(resultado.linea.slice(2, 2 + Number(longitud))).toBe(cuenta);
    expect(resultado.control).toBe(2n);
    expect(resultado.linea).toHaveLength(195);
  });
  it.each([
    ['sin cuenta', { cuenta: null }, 'dígitos'],
    [
      'documento demasiado largo',
      {
        cabecera: {
          ...filaExportacion().cabecera,
          nro_documento: '1234567890123',
        },
      },
      'documento',
    ],
    ['neto cero', { resultado: { neto_a_pagar: '0' } }, 'positivo'],
    [
      'neto fuera de ancho',
      { resultado: { neto_a_pagar: '99999999999999999' } },
      '17 posiciones',
    ],
    [
      'nombre no admitido',
      {
        cabecera: { ...filaExportacion().cabecera, nombre_completo: 'DEMO 💰' },
      },
      'texto no admitido',
    ],
  ])('rechaza %s en un abono', (_nombre, cambio, mensaje) => {
    // Arrange: un dato del colaborador no cabe en la estructura elegida.
    const fila = { ...filaExportacion(), ...cambio } as never;
    // Act: intentar construir el registro exacto del banco.
    const actuar = () => detalleBcp(fila, configuracionExportacion());
    // Assert: no truncar importes ni introducir caracteres ajenos al canal.
    expect(actuar).toThrow(mensaje);
  });
  it('rechaza que cuenta de cargo y cuenta de abono sean iguales', () => {
    // Arrange: ambas cuentas corrientes apuntan al mismo número.
    const fila = { ...filaExportacion(), cuenta: '1910000000001' };
    const config = {
      ...configuracionExportacion(),
      tipos_cuenta_abono: { [fila.empleado_id]: 'C' },
    } as never;
    // Act: intentar pagar desde y hacia la misma cuenta.
    const actuar = () => detalleBcp(fila, config);
    // Assert: informar el error antes de escribir el detalle.
    expect(actuar).toThrow('coincidir');
  });
  it.each([0, -1, 1.5, NaN])(
    'rechaza cantidad inválida de abonos %s',
    (cantidad) => {
      // Arrange: una cabecera válida con cantidad no positiva o no entera.
      const config = configuracionExportacion();
      // Act: construir la cabecera.
      const actuar = () => cabeceraBanco(config, cantidad, '100', 0n);
      // Assert: el archivo no debe anunciar una cantidad imposible.
      expect(actuar).toThrow('al menos un abono');
    }
  );
  it('rechaza un total que no cabe en el campo de cabecera', () => {
    // Arrange: total que supera el ancho del importe bancario.
    const actuar = () =>
      cabeceraBanco(configuracionExportacion(), 1, '99999999999999999', 0n);
    // Act / Assert: no cortar dígitos del total.
    expect(actuar).toThrow('ancho');
  });
});
