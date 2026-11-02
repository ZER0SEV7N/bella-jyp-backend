import { lineaAFPNET } from '@/modules/integraciones/domain/afpnet';
import {
  filaExportacion,
  configuracionExportacion,
} from '../../../fixtures/exportacion.fixture';
describe('AFPnet de 141 posiciones', () => {
  it('conserva los centavos implícitos y los apellidos separados', () => {
    // Arrange: base 600.20 y nombres confirmados por el contador.
    const fila = filaExportacion();
    fila.resultado.base_previsional = '600.20';
    // Act: generar la línea de declaración.
    const r = lineaAFPNET(fila, 1, configuracionExportacion());
    // Assert: cada campo ocupa su posición, sin punto decimal en remuneración.
    expect(r.length).toBe(141);
    expect(r.slice(0, 5)).toBe('00001');
    expect(r.slice(102, 111)).toBe('000060020');
    expect(r.slice(38, 58).trim()).toBe('RAMOS');
  });
  it('no intenta adivinar el apellido materno', () => {
    // Arrange: apellido conjunto sin confirmación de sus dos componentes.
    const config = {
      ...configuracionExportacion(),
      apellidos_afpnet: undefined,
    };
    // Act: generar la línea.
    const operar = () => lineaAFPNET(filaExportacion(), 1, config);
    // Assert: dato faltante explícito.
    expect(operar).toThrow('separados');
  });
  it('rechaza al afiliado ONP', () => {
    // Arrange: trabajador del sistema nacional de pensiones.
    const fila = { ...filaExportacion(), regimen: 'ONP' as const };
    // Act: intentar incluirlo en AFPnet.
    const operar = () => lineaAFPNET(fila, 1, configuracionExportacion());
    // Assert: no mezclar regímenes.
    expect(operar).toThrow('SPP');
  });
});

describe('AFPnet: validaciones de datos y movimientos del período', () => {
  it.each([
    ['régimen ONP', { regimen: 'ONP' }, 'SPP'],
    ['CUSPP inválido', { cuspp: 'CORTO' }, 'doce'],
    ['base cero', { resultado: { base_previsional: '0' } }, 'excepción'],
  ])('rechaza %s', (_nombre, cambio, mensaje) => {
    // Arrange: una condición incompatible con el formato AFPnet.
    const fila = { ...filaExportacion(), ...cambio } as never;
    // Act: preparar la línea con configuración explícita.
    const actuar = () => lineaAFPNET(fila, 1, configuracionExportacion());
    // Assert: no producir un registro que aparente estar completo.
    expect(actuar).toThrow(mensaje);
  });
  it.each(['apellidos_afpnet', 'aportes_voluntarios'])(
    'requiere confirmar %s',
    (campo) => {
      // Arrange: falta una decisión de origen que no puede inferirse.
      const config = { ...configuracionExportacion(), [campo]: undefined };
      // Act: construir la línea sin el dato requerido.
      const actuar = () => lineaAFPNET(filaExportacion(), 1, config);
      // Assert: no dividir apellidos ni asumir aportes voluntarios silenciosamente.
      expect(actuar).toThrow();
    }
  );
  it('distingue ingreso anterior y cese en el mes, admitiendo CUSPP vacío', () => {
    // Arrange: trabajador cesado en septiembre cuyo ingreso fue meses antes.
    const fila = {
      ...filaExportacion(),
      fecha_inicio: '2026-01-01',
      fecha_cese: '2026-09-30',
      cuspp: null,
    };
    // Act: exportar los movimientos del período.
    const linea = lineaAFPNET(fila, 2, configuracionExportacion());
    // Assert: posiciones fijas: vínculo S, inicio N y cese S; CUSPP se deja en blanco.
    expect(linea).toHaveLength(141);
    expect(linea.slice(5, 17)).toBe(' '.repeat(12));
    expect(linea.slice(98, 101)).toBe('SNS');
  });
});
