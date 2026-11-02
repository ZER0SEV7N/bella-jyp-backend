import {
  lineaJornadaPlame,
  lineasRemuneracionPlame,
  nombrePlame,
} from '@/modules/integraciones/domain/plame';
import {
  filaExportacion,
  configuracionExportacion,
} from '../../../fixtures/exportacion.fixture';
describe('SUNAT Anexo 3: estructuras 14 y 18', () => {
  it('declara las horas reales y no multiplica treinta días por ocho', () => {
    // Arrange: 22 jornadas de ocho horas y 90 minutos de sobretiempo.
    const fila = { ...filaExportacion(), minutos_sobretiempo: 90 };
    // Act: serializar estructura 14.
    const r = lineaJornadaPlame(fila);
    // Assert: seis campos y cociente/residuo en horas/minutos.
    expect(r).toBe('01|09900001|176|0|1|30');
    expect(nombrePlame('2026-09', '20000000001', 'jor')).toBe(
      '060120260920000000001.jor'
    );
  });
  it('requiere confirmación de los montos efectivamente pagados', () => {
    // Arrange: solo se cerró el cálculo, sin confirmación de pago.
    const config = {
      ...configuracionExportacion(),
      confirmar_montos_pagados: false,
    };
    // Act: intentar generar remuneraciones.
    const operar = () => lineasRemuneracionPlame(filaExportacion(), config);
    // Assert: cierre y pago no se consideran equivalentes.
    expect(operar).toThrow('Confirme');
  });
  it('no exporta ONP o EsSalud en conceptos que SUNAT excluye de rem', () => {
    // Arrange: conceptos que el aplicativo calcula con sus bases.
    const fila = filaExportacion();
    fila.resultado.aporte_onp = '195';
    fila.resultado.aporte_essalud = '135';
    // Act: generar líneas importables.
    const r = lineasRemuneracionPlame(fila, configuracionExportacion());
    // Assert: código básico correcto y ausencia de los códigos excluidos.
    expect(r).toContain('01|09900001|0121|1500.00|1500.00');
    expect(r.some((x) => /\|(0607|0804)\|/.test(x))).toBe(false);
  });
  it('no asigna un código arbitrario a un bono ambiguo', () => {
    // Arrange: bono sin clasificación expresa.
    const fila = filaExportacion();
    fila.resultado.bono_extraordinario = '50';
    // Act: intentar generar remuneraciones.
    const operar = () =>
      lineasRemuneracionPlame(fila, configuracionExportacion());
    // Assert: se requiere el código contable acordado.
    expect(operar).toThrow('clasificación');
  });
});
