//test/modules/core/audit/helpers/ocultar-huellas-auditoria.helper.spec.ts
import { ocultarHuellasAuditoria } from '@/modules/core/audit/helpers/ocultar-huellas-auditoria.helper';

describe('ocultarHuellasAuditoria', () => {
  it('Debe reemplazar la huella por [OCULTO] a cualquier profundidad sin modificar el original', () => {
    // Arrange
    const original = {
      cuspp: '[OCULTO:0a1b2c3d4e]',
      anidado: {
        cci_cts: '[OCULTO:ffffffffff]',
        lista: ['[OCULTO:0123456789]', 'texto'],
      },
    };

    // Act
    const resultado = ocultarHuellasAuditoria(original);

    // Assert
    expect(resultado).toEqual({
      cuspp: '[OCULTO]',
      anidado: { cci_cts: '[OCULTO]', lista: ['[OCULTO]', 'texto'] },
    });
    expect(original.cuspp).toBe('[OCULTO:0a1b2c3d4e]');
  });

  it('Debe dejar igual [OCULTO], textos parecidos, números, nulos y fechas', () => {
    // Arrange
    const fecha = new Date('2026-11-08T15:20:00.000Z');
    const valores = {
      a: '[OCULTO]',
      b: 'nota [OCULTO:abc123]',
      c: 12,
      d: null,
      e: true,
      f: fecha,
    };

    // Act
    const resultado = ocultarHuellasAuditoria(valores);

    // Assert
    expect(resultado).toEqual(valores);
    expect(resultado.f).toBe(fecha);
  });

  it('Debe aceptar null y valores simples', () => {
    // Arrange y Act y Assert
    expect(ocultarHuellasAuditoria(null)).toBeNull();
    expect(ocultarHuellasAuditoria('[OCULTO:abcdef0123]')).toBe('[OCULTO]');
  });
});
