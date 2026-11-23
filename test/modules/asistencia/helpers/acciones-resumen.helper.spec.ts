import { ConflictException } from '@nestjs/common';
import {
  calcularAccionesResumen,
  validarAccionResumen,
  type ResumenEvaluable,
} from '@/modules/asistencia/helpers/acciones-resumen.helper';

/** Prueba aislada: Arrange prepara datos; Act evalúa acciones; Assert verifica motivos y prioridades. */
describe('acciones-resumen.helper', () => {
  const basePendienteValido: ResumenEvaluable = {
    estado: 'PENDIENTE',
    vigente: true,
    completo: true,
    pendientes: 0,
    detalle: {
      dias: [{ fecha: '2026-09-01', alertas: [] }],
    },
  };

  it('permite aprobar y rechazar cuando el resumen está pendiente y válido (sin planilla o con planilla abierta)', () => {
    expect(calcularAccionesResumen(basePendienteValido)).toEqual({
      aprobar: null,
      rechazar: null,
      reabrir: 'El resumen ya está pendiente.',
    });
    expect(calcularAccionesResumen(basePendienteValido, null)).toEqual({
      aprobar: null,
      rechazar: null,
      reabrir: 'El resumen ya está pendiente.',
    });
    expect(calcularAccionesResumen(basePendienteValido, 'ABIERTO')).toEqual({
      aprobar: null,
      rechazar: null,
      reabrir: 'El resumen ya está pendiente.',
    });

    expect(() =>
      validarAccionResumen(basePendienteValido, 'aprobar')
    ).not.toThrow();
    expect(() =>
      validarAccionResumen(basePendienteValido, 'rechazar')
    ).not.toThrow();
  });

  it('permite reabrir cuando el resumen está aprobado o rechazado', () => {
    expect(
      calcularAccionesResumen({ ...basePendienteValido, estado: 'APROBADO' })
    ).toEqual({
      aprobar: 'Solo se puede aprobar un resumen pendiente.',
      rechazar: 'Solo se puede rechazar un resumen pendiente.',
      reabrir: null,
    });
    expect(
      calcularAccionesResumen({ ...basePendienteValido, estado: 'RECHAZADO' })
    ).toEqual({
      aprobar: 'Solo se puede aprobar un resumen pendiente.',
      rechazar: 'Solo se puede rechazar un resumen pendiente.',
      reabrir: null,
    });

    expect(() =>
      validarAccionResumen(
        { ...basePendienteValido, estado: 'APROBADO' },
        'reabrir'
      )
    ).not.toThrow();
  });

  it('bloquea todas las acciones cuando la planilla ya no está abierta', () => {
    for (const estadoPlanilla of ['EN_REVISION', 'CONGELADO', 'DECLARADO']) {
      expect(
        calcularAccionesResumen(basePendienteValido, estadoPlanilla)
      ).toEqual({
        aprobar:
          'La planilla de este mes ya no está abierta: no se puede cambiar su asistencia.',
        rechazar:
          'La planilla de este mes ya no está abierta: no se puede cambiar su asistencia.',
        reabrir:
          'La planilla de este mes ya no está abierta: no se puede cambiar su asistencia.',
      });
    }
  });

  it('prioriza resumen desactualizado antes que días sin jornada, pendientes o incompleto', () => {
    const resumen: ResumenEvaluable = {
      estado: 'PENDIENTE',
      vigente: false,
      completo: false,
      pendientes: 2,
      detalle: {
        dias: [{ alertas: ['JORNADA_HISTORICA_NO_ASIGNADA'] }],
      },
    };

    expect(calcularAccionesResumen(resumen).aprobar).toBe(
      'El resumen está desactualizado: actualízalo para poder aprobarlo.'
    );
  });

  it('detecta días sin jornada asignada en singular y plural antes que pendientes', () => {
    const conUnDia = calcularAccionesResumen({
      ...basePendienteValido,
      pendientes: 3,
      completo: false,
      detalle: {
        dias: [
          { alertas: ['JORNADA_HISTORICA_NO_ASIGNADA'] },
          { alertas: ['OTRA_ALERTA'] },
        ],
      },
    });
    expect(conUnDia.aprobar).toBe(
      'Hay 1 día sin jornada asignada: asigna una jornada y actualiza el resumen para poder aprobarlo.'
    );

    const conVariosDias = calcularAccionesResumen({
      ...basePendienteValido,
      pendientes: 1,
      detalle: {
        dias: [
          { alertas: ['JORNADA_HISTORICA_NO_ASIGNADA'] },
          { alertas: ['JORNADA_HISTORICA_NO_ASIGNADA'] },
        ],
      },
    });
    expect(conVariosDias.aprobar).toBe(
      'Hay 2 días sin jornada asignada: asigna una jornada y actualiza el resumen para poder aprobarlo.'
    );
  });

  it('tolera formas inválidas de detalle JSON sin fallar', () => {
    for (const detalle of [
      undefined,
      null,
      'texto',
      [],
      { dias: 'no-array' },
      { dias: [null, 123, { alertas: 'no-array' }] },
    ]) {
      expect(
        calcularAccionesResumen({ ...basePendienteValido, detalle }).aprobar
      ).toBeNull();
    }
  });

  it('reporta días pendientes en singular y plural antes que mes incompleto', () => {
    expect(
      calcularAccionesResumen({
        ...basePendienteValido,
        pendientes: 1,
        completo: false,
      }).aprobar
    ).toBe('Hay 1 día por resolver antes de aprobar.');

    expect(
      calcularAccionesResumen({
        ...basePendienteValido,
        pendientes: 4,
        completo: false,
      }).aprobar
    ).toBe('Hay 4 días por resolver antes de aprobar.');
  });

  it('bloquea aprobar cuando todavía hay días sin evaluar', () => {
    expect(
      calcularAccionesResumen({
        ...basePendienteValido,
        completo: false,
      }).aprobar
    ).toBe(
      'Todavía hay días sin evaluar: se podrá aprobar cuando el mes esté completo.'
    );
  });

  it('validarAccionResumen lanza ConflictException con título y detalle, con o sin prefijo', () => {
    try {
      validarAccionResumen(basePendienteValido, 'reabrir');
      throw new Error('Debió lanzar ConflictException');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        title: 'Acción no permitida',
        detail: 'El resumen ya está pendiente.',
      });
    }

    try {
      validarAccionResumen(
        basePendienteValido,
        'reabrir',
        'El colaborador emp-1: '
      );
      throw new Error('Debió lanzar ConflictException');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        title: 'Acción no permitida',
        detail: 'El colaborador emp-1: El resumen ya está pendiente.',
      });
    }
  });
});
