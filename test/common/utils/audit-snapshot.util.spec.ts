import { crearSnapshotAuditoria } from '@/common/utils/audit-snaphot.util';
import { CryptoUtil } from '@/common/utils/crypto.util';

describe('crearSnapshotAuditoria - Datos sensibles', () => {
  it('Debe ocultar secretos anidados sin modificar el objeto original', () => {
    // Arrange: preparar un resultado con credenciales y datos operativos.
    const original = {
      id: 'usuario',
      usuarios: [{ password_hash: 'hash', email: 'demo@example.test' }],
      accessToken: 'token',
    };
    // Act: crear la representación persistible de auditoría.
    const snapshot = crearSnapshotAuditoria(original);
    // Assert: mantener datos operativos y ocultar secretos a cualquier profundidad.
    expect(snapshot).toEqual({
      id: 'usuario',
      usuarios: [{ password_hash: '[OCULTO]', email: 'demo@example.test' }],
      accessToken: '[OCULTO]',
    });
    expect(original.usuarios[0].password_hash).toBe('hash');
  });

  it('Debe preservar fechas serializadas y valores nulos', () => {
    // Arrange: cambio de negocio con fecha y campo sin contenido.
    const fecha = new Date('2026-10-01T00:00:00Z');
    // Act: crear el snapshot.
    const snapshot = crearSnapshotAuditoria({
      fecha,
      observacion: null,
      refreshToken: 'secreto',
    });
    // Assert: obtener un objeto JSON sin referencias al original.
    expect(snapshot).toEqual({
      fecha: fecha.toISOString(),
      observacion: null,
      refreshToken: '[OCULTO]',
    });
  });
});

describe('crearSnapshotAuditoria - Huella de datos protegidos', () => {
  const SECRETO = 'secreto_de_huella_de_prueba_con_32_caracteres_minimo';
  const original = process.env.AUDITORIA_HUELLA_SECRETO;
  const originalLlave = process.env.FINANCIAL_DATA_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY =
      'test_financial_encryption_key_32_chars_min';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.AUDITORIA_HUELLA_SECRETO;
    else process.env.AUDITORIA_HUELLA_SECRETO = original;
    if (originalLlave === undefined)
      delete process.env.FINANCIAL_DATA_ENCRYPTION_KEY;
    else process.env.FINANCIAL_DATA_ENCRYPTION_KEY = originalLlave;
  });

  it('Debe guardar [OCULTO] sin huella si el secreto no está configurado', () => {
    // Arrange
    delete process.env.AUDITORIA_HUELLA_SECRETO;
    // Act
    const snapshot = crearSnapshotAuditoria({
      cuspp: '123456ABCDE',
      nro_cuenta_sueldo: '19198765432012',
    });
    // Assert
    expect(snapshot).toEqual({
      cuspp: '[OCULTO]',
      nro_cuenta_sueldo: '[OCULTO]',
    });
  });

  it('Debe guardar [OCULTO:<huella>] determinista y distinta para valores distintos', () => {
    // Arrange
    process.env.AUDITORIA_HUELLA_SECRETO = SECRETO;
    // Act
    const uno = crearSnapshotAuditoria({
      nro_cuenta_sueldo: '19198765432012',
    }) as Record<string, string>;
    const otraVez = crearSnapshotAuditoria({
      nro_cuenta_sueldo: '19198765432012',
    }) as Record<string, string>;
    const otro = crearSnapshotAuditoria({
      nro_cuenta_sueldo: '19198765432013',
    }) as Record<string, string>;
    // Assert
    expect(uno.nro_cuenta_sueldo).toMatch(/^\[OCULTO:[0-9a-f]{10}\]$/);
    expect(otraVez.nro_cuenta_sueldo).toBe(uno.nro_cuenta_sueldo);
    expect(otro.nro_cuenta_sueldo).not.toBe(uno.nro_cuenta_sueldo);
    expect(uno.nro_cuenta_sueldo).not.toContain('19198765432012');
  });

  it('Debe producir huellas distintas con otro secreto, para que no se puedan probar candidatos sin él', () => {
    // Arrange
    process.env.AUDITORIA_HUELLA_SECRETO = SECRETO;
    const conUno = crearSnapshotAuditoria({
      cci_cts: '00219100123456789012',
    }) as Record<string, string>;
    process.env.AUDITORIA_HUELLA_SECRETO = `${SECRETO}-otro`;
    // Act
    const conOtro = crearSnapshotAuditoria({
      cci_cts: '00219100123456789012',
    }) as Record<string, string>;
    // Assert
    expect(conOtro.cci_cts).not.toBe(conUno.cci_cts);
  });

  it('Debe calcular la huella sobre el dato descifrado: el mismo número cifrado dos veces da la misma huella', () => {
    // Arrange
    process.env.AUDITORIA_HUELLA_SECRETO = SECRETO;
    const cifradoA = CryptoUtil.encrypt('19198765432012');
    const cifradoB = CryptoUtil.encrypt('19198765432012');
    // Act
    const a = crearSnapshotAuditoria({ nro_cuenta_sueldo: cifradoA }) as Record<
      string,
      string
    >;
    const b = crearSnapshotAuditoria({ nro_cuenta_sueldo: cifradoB }) as Record<
      string,
      string
    >;
    // Assert
    expect(cifradoA).not.toBe(cifradoB);
    expect(a.nro_cuenta_sueldo).toBe(b.nro_cuenta_sueldo);
  });

  it('Debe mantener [OCULTO] plano en credenciales y tokens aunque haya secreto', () => {
    // Arrange
    process.env.AUDITORIA_HUELLA_SECRETO = SECRETO;
    // Act
    const snapshot = crearSnapshotAuditoria({
      password_hash: 'x',
      accessToken: 'y',
      solicitud_cifrada: 'z',
      cuspp: null,
    });
    // Assert
    expect(snapshot).toEqual({
      password_hash: '[OCULTO]',
      accessToken: '[OCULTO]',
      solicitud_cifrada: '[OCULTO]',
      cuspp: null,
    });
  });
});
