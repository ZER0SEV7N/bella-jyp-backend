//test/modules/RRHH/dashboard/helpers/dashboard-asistencia.helper.spec.ts
import { ALERTA_SIN_JORNADA } from '@/modules/asistencia/helpers/acciones-resumen.helper';
import { construirAsistenciaSemana } from '@/modules/RRHH/dashboard/helpers/dashboard-asistencia.helper';

describe('dashboard-asistencia.helper', () => {
  it('clasifica estados, ignora no laborables y NO_EVALUADO, calcula puntualidad y días sin jornada', () => {
    const fechasVisibles = ['2026-11-16', '2026-11-17', '2026-11-18'];
    const filas = [
      {
        actualizado_en: new Date('2026-11-18T12:00:00.000Z'),
        detalle: {
          version_motor: '1.0',
          dias: [
            // Ignorados (no cuentan en esperados ni pendientes)
            {
              fecha: '2026-11-16',
              estado: 'FUERA_DE_VINCULO',
              minutos_tardanza: 0,
              alertas: [],
            },
            {
              fecha: '2026-11-17',
              estado: 'DESCANSO_SEMANAL',
              minutos_tardanza: 0,
              alertas: [],
            },
            {
              fecha: '2026-11-18',
              estado: 'FERIADO_O_DESCANSO_ACORDADO',
              minutos_tardanza: 0,
              alertas: [],
            },
            {
              fecha: '2026-11-18',
              estado: 'NO_EVALUADO',
              minutos_tardanza: 0,
              alertas: [],
            },
            // Fuera del rango visible (jueves)
            {
              fecha: '2026-11-19',
              estado: 'ASISTENCIA_REGISTRADA',
              minutos_tardanza: 0,
              alertas: [ALERTA_SIN_JORNADA],
            },
          ],
        },
      },
      {
        actualizado_en: new Date('2026-11-18T16:30:00.000Z'),
        detalle: {
          version_motor: '1.0',
          dias: [
            {
              fecha: '2026-11-16',
              estado: 'ASISTENCIA_REGISTRADA',
              minutos_tardanza: 0,
              alertas: [],
            },
            {
              fecha: '2026-11-17',
              estado: 'ASISTENCIA_REGISTRADA',
              minutos_tardanza: 12,
              alertas: [],
            },
            {
              fecha: '2026-11-18',
              estado: 'FALTA_INJUSTIFICADA',
              minutos_tardanza: 0,
              alertas: [],
            },
          ],
        },
      },
      {
        actualizado_en: new Date('2026-11-18T14:00:00.000Z'),
        detalle: {
          version_motor: '1.0',
          dias: [
            {
              fecha: '2026-11-16',
              estado: 'JUSTIFICADA',
              minutos_tardanza: 0,
              alertas: [],
            },
            {
              fecha: '2026-11-17',
              estado: 'AUSENCIA_SIN_GOCE',
              minutos_tardanza: 0,
              alertas: [],
            },
            {
              fecha: '2026-11-18',
              estado: 'PENDIENTE',
              minutos_tardanza: 0,
              alertas: [ALERTA_SIN_JORNADA],
            },
          ],
        },
      },
      {
        actualizado_en: new Date('2026-11-18T11:00:00.000Z'),
        detalle: {
          version_motor: '1.0',
          dias: [
            {
              fecha: '2026-11-16',
              estado: 'AUSENCIA_PENDIENTE',
              minutos_tardanza: 0,
              alertas: [],
            },
            {
              fecha: '2026-11-17',
              estado: 'MARCACION_INCOMPLETA',
              minutos_tardanza: 0,
              alertas: [],
            },
            {
              fecha: '2026-11-18',
              estado: 'ESTADO_DESCONOCIDO',
              minutos_tardanza: 0,
              alertas: [],
            },
          ],
        },
      },
    ];

    const resultado = construirAsistenciaSemana(
      fechasVisibles,
      '2026-11-16',
      '2026-11-20',
      filas
    );

    expect(resultado).toEqual({
      desde: '2026-11-16',
      hasta: '2026-11-20',
      dias: [
        {
          fecha: '2026-11-16',
          esperados: 3,
          puntuales: 1,
          tardanzas: 0,
          faltas: 0,
          justificadas: 1,
          pendientes: 1,
        },
        {
          fecha: '2026-11-17',
          esperados: 3,
          puntuales: 0,
          tardanzas: 1,
          faltas: 0,
          justificadas: 1,
          pendientes: 1,
        },
        {
          fecha: '2026-11-18',
          esperados: 3,
          puntuales: 0,
          tardanzas: 0,
          faltas: 1,
          justificadas: 0,
          pendientes: 2,
        },
      ],
      puntualidad_porcentaje: 11.11,
      fuente: 'INCIDENCIAS_CALCULADAS',
      ultima_actualizacion: '2026-11-18T16:30:00.000Z',
      dias_empleado_sin_jornada: 1,
    });
  });

  it('retorna puntualidad y ultima_actualizacion en null cuando solo hay días NO_EVALUADO o sin filas', () => {
    const sinFilas = construirAsistenciaSemana(
      ['2026-11-16'],
      '2026-11-16',
      '2026-11-20',
      []
    );

    expect(sinFilas.puntualidad_porcentaje).toBeNull();
    expect(sinFilas.ultima_actualizacion).toBeNull();

    const soloNoEvaluado = construirAsistenciaSemana(
      ['2026-11-16'],
      '2026-11-16',
      '2026-11-20',
      [
        {
          actualizado_en: new Date('2026-11-16T08:00:00.000Z'),
          detalle: {
            version_motor: '1.0',
            dias: [
              {
                fecha: '2026-11-16',
                estado: 'NO_EVALUADO',
                minutos_tardanza: 0,
                alertas: [],
              },
            ],
          },
        },
      ]
    );

    expect(soloNoEvaluado).toEqual({
      desde: '2026-11-16',
      hasta: '2026-11-20',
      dias: [
        {
          fecha: '2026-11-16',
          esperados: 0,
          puntuales: 0,
          tardanzas: 0,
          faltas: 0,
          justificadas: 0,
          pendientes: 0,
        },
      ],
      puntualidad_porcentaje: null,
      fuente: 'INCIDENCIAS_CALCULADAS',
      ultima_actualizacion: '2026-11-16T08:00:00.000Z',
      dias_empleado_sin_jornada: 0,
    });
  });
});
