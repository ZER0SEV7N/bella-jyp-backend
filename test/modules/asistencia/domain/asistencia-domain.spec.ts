// test/modules/asistencia/domain/asistencia-domain.spec.ts
import { feriadosNacionalesPeru } from '@/modules/asistencia/domain/calendario-peru';
import { duracion, horarioProgramado, intervalosTrabajados, minutos, restar } from '@/modules/asistencia/domain/intervalos-asistencia';
import { minutosEfectivos, validarJornadaRegular } from '@/modules/asistencia/domain/validar-jornada';
import { diasMedicosAcumulados, intervaloSolicitud } from '@/modules/asistencia/domain/solicitudes-asistencia';
import { aplicarDecisionAusencia, prepararJustificaciones } from '@/modules/asistencia/domain/justificaciones-dia';
import { evaluarDescanso, prepararDia } from '@/modules/asistencia/domain/preparar-dia';
import { evaluarAusencia } from '@/modules/asistencia/domain/evaluar-ausencia';
import { evaluarMarcaciones } from '@/modules/asistencia/domain/evaluar-marcaciones';
import { evaluarFecha } from '@/modules/asistencia/domain/evaluar-dia';
import { calcularAsistencia, diasDeVinculo, VERSION_MOTOR_ASISTENCIA } from '@/modules/asistencia/domain/calcular-asistencia';
import type { ContextoAsistencia, HorarioDia, JornadaHistorica, ResultadoDia, SolicitudAsistencia } from '@/modules/asistencia/domain/asistencia.types';

/**
 * Crea un horario semanal válido de 48 horas (lunes a sábado, 8 horas efectivas diarias).
 */
function crearHorarioSemanal48(): HorarioDia[] {
  const diasLaborables = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const;
  return [
    ...diasLaborables.map((dia) => ({
      dia,
      laborable: true,
      modalidad: 'PRESENCIAL' as const,
      entrada: '08:00',
      inicio_descanso: '13:00',
      fin_descanso: '14:00',
      salida: '17:00',
    })),
    {
      dia: 'DOMINGO',
      laborable: false,
      modalidad: 'PRESENCIAL' as const,
      entrada: null,
      inicio_descanso: null,
      fin_descanso: null,
      salida: null,
    },
  ];
}

/**
 * Crea una estructura base de ResultadoDia para pruebas unitarias.
 */
function crearResultadoBase(fecha = '2026-10-05'): ResultadoDia {
  return {
    fecha,
    estado: 'FUERA_DE_VINCULO',
    modalidad: null,
    marcas: [],
    solicitudes: [],
    minutos_programados: 480,
    minutos_trabajados: 0,
    minutos_tardanza: 0,
    minutos_salida_anticipada: 0,
    minutos_sin_goce: 0,
    minutos_extra_observados: 0,
    minutos_extra_25: 0,
    minutos_extra_35: 0,
    falta: 0,
    sin_goce: 0,
    alertas: [],
  };
}

/**
 * Crea un contexto determinista de asistencia para pruebas del motor de dominio.
 */
function crearContextoBase(): ContextoAsistencia {
  const jornada: JornadaHistorica = {
    desde: '2026-01-01',
    horario: crearHorarioSemanal48(),
    tolerancia_minutos: 5,
    politica_tolerancia: 'COMPLETA',
    minutos_semana: 2880,
  };
  return {
    periodo: '2026-10',
    ahora: '2026-11-02T15:00:00.000Z',
    empleado: {
      id: '0195f000-0000-7000-8000-000000000001',
      fecha_inicio: '2026-01-01',
      fecha_cese: null,
    },
    marcaciones: [],
    solicitudes: [],
    jornadas: [jornada],
    decisiones: [],
    descansos: [],
  };
}

describe('Motor de Dominio de Asistencia (Legislación Laboral Peruana)', () => {
  describe('calendario-peru.ts (Feriados Nacionales D. Leg. N° 713)', () => {
    it('debería calcular los feriados nacionales de 2026 incluyendo Jueves y Viernes Santo y los nuevos feriados legales', () => {
      // Arrange
      const anio = 2026;

      // Act
      const feriados = feriadosNacionalesPeru(anio);

      // Assert
      expect(feriados.some((f) => f.fecha === '2026-04-02' && f.nombre === 'Jueves Santo')).toBe(true);
      expect(feriados.some((f) => f.fecha === '2026-04-03' && f.nombre === 'Viernes Santo')).toBe(true);
      expect(feriados.some((f) => f.fecha === '2026-06-07')).toBe(true);
      expect(feriados.some((f) => f.fecha === '2026-07-23')).toBe(true);
      expect(feriados.some((f) => f.fecha === '2026-08-06')).toBe(true);
      expect(feriados.some((f) => f.fecha === '2026-12-09')).toBe(true);
    });

    it('no debería incluir retroactivamente los feriados incorporados en 2022 y 2023 para años históricos', () => {
      // Arrange
      const anioHistorico = 2021;

      // Act
      const feriados = feriadosNacionalesPeru(anioHistorico);

      // Assert
      expect(feriados.some((f) => f.fecha === '2021-08-06')).toBe(false);
      expect(feriados.some((f) => f.fecha === '2021-07-23')).toBe(false);
    });

    it('debería lanzar RangeError cuando el año está fuera del rango soportado (1992-9998)', () => {
      // Arrange & Act & Assert
      expect(() => feriadosNacionalesPeru(1990)).toThrow(RangeError);
      expect(() => feriadosNacionalesPeru(10000)).toThrow(RangeError);
    });
  });

  describe('intervalos-asistencia.ts (Cálculo de Intervalos y Refrigerio)', () => {
    it('debería convertir horas a minutos, calcular duración y restar intervalos superpuestos', () => {
      // Arrange
      const base: [number, number][] = [[480, 1020]]; // 08:00 a 17:00
      const coberturas: [number, number][] = [[780, 840], [1050, 1100]]; // 13:00 a 14:00 y uno externo

      // Act
      const resultado = restar(base, coberturas);

      // Assert
      expect(minutos('08:30')).toBe(510);
      expect(resultado).toEqual([[480, 780], [840, 1020]]);
      expect(duracion(resultado)).toBe(480);
    });

    it('debería validar y construir el horarioProgramado con y sin refrigerio o rechazar horarios inválidos', () => {
      // Arrange
      const conRefrigerio: HorarioDia = {
        dia: 'LUNES',
        laborable: true,
        entrada: '08:00',
        inicio_descanso: '13:00',
        fin_descanso: '14:00',
        salida: '17:00',
      };
      const sinRefrigerio: HorarioDia = {
        dia: 'LUNES',
        laborable: true,
        entrada: '08:00',
        inicio_descanso: null,
        fin_descanso: null,
        salida: '12:00',
      };

      // Act & Assert
      expect(horarioProgramado(conRefrigerio)).toEqual([[480, 780], [840, 1020]]);
      expect(horarioProgramado(sinRefrigerio)).toEqual([[480, 720]]);
      expect(horarioProgramado({ ...conRefrigerio, entrada: null })).toBeNull();
      expect(horarioProgramado({ ...conRefrigerio, entrada: '18:00', salida: '08:00' })).toBeNull();
      expect(horarioProgramado({ ...conRefrigerio, inicio_descanso: '13:00', fin_descanso: null })).toBeNull();
      expect(horarioProgramado({ ...conRefrigerio, inicio_descanso: '07:00', fin_descanso: '14:00' })).toBeNull();
    });

    it('debería calcular intervalosTrabajados con 2 o 4 marcaciones y rechazar secuencias inválidas', () => {
      // Arrange
      const horario: HorarioDia = {
        dia: 'LUNES',
        laborable: true,
        entrada: '08:00',
        inicio_descanso: '13:00',
        fin_descanso: '14:00',
        salida: '17:00',
      };

      // Act
      const conDosMarcas = intervalosTrabajados(
        [
          { tipo: 'ENTRADA', hora: '08:00' },
          { tipo: 'SALIDA', hora: '17:00' },
        ],
        horario,
      );
      const conCuatroMarcas = intervalosTrabajados(
        [
          { tipo: 'ENTRADA', hora: '08:00' },
          { tipo: 'SALIDA_ALMUERZO', hora: '13:00' },
          { tipo: 'ENTRADA_ALMUERZO', hora: '14:00' },
          { tipo: 'SALIDA', hora: '17:00' },
        ],
        horario,
      );
      const desordenado = intervalosTrabajados(
        [
          { tipo: 'ENTRADA', hora: '17:00' },
          { tipo: 'SALIDA', hora: '08:00' },
        ],
        horario,
      );
      const incompleto = intervalosTrabajados([{ tipo: 'ENTRADA', hora: '08:00' }], horario);

      // Assert
      expect(conDosMarcas).toEqual([[480, 780], [840, 1020]]);
      expect(conCuatroMarcas).toEqual([[480, 780], [840, 1020]]);
      expect(desordenado).toBeNull();
      expect(incompleto).toBeNull();
    });
  });

  describe('validar-jornada.ts (Restricciones de Jornada Regular de 40 a 48h)', () => {
    it('debería validar exitosamente un horario semanal regular de 48 horas y rechazar configuraciones inválidas', () => {
      // Arrange
      const horario = crearHorarioSemanal48();

      // Act
      const totalMinutos = validarJornadaRegular(horario, 2880);

      // Assert
      expect(totalMinutos).toBe(2880);
      expect(() => minutosEfectivos({ ...horario[0], entrada: null })).toThrow(RangeError);
      expect(() => minutosEfectivos({ ...horario[0], entrada: '05:00' })).toThrow(RangeError);
      expect(() => minutosEfectivos({ ...horario[0], inicio_descanso: '13:00', fin_descanso: '13:30' })).toThrow(RangeError);
      expect(() => validarJornadaRegular(horario.slice(0, 5), 2880)).toThrow(RangeError);
      expect(() =>
        validarJornadaRegular(
          horario.map((h) => ({ ...h, laborable: false })),
          0,
        ),
      ).toThrow(RangeError);
      expect(() => validarJornadaRegular(horario, 2400)).toThrow(RangeError);
    });
  });

  describe('solicitudes-asistencia.ts y justificaciones-dia.ts', () => {
    it('debería calcular intervalos de solicitud, días médicos acumulados y alertas de justificación', () => {
      // Arrange
      const contexto = crearContextoBase();
      const solicitudes: SolicitudAsistencia[] = [
        {
          id: 'sol-1',
          tipo: 'LICENCIA_MEDICA',
          estado: 'APROBADA',
          fecha_inicio: '2026-01-01',
          fecha_fin: '2026-01-21',
          hora_inicio: null,
          hora_fin: null,
          efecto_asistencia: 'CON_GOCE',
        },
        {
          id: 'sol-2',
          tipo: 'PERMISO',
          estado: 'APROBADA',
          fecha_inicio: '2026-10-05',
          fecha_fin: '2026-10-05',
          hora_inicio: '08:00',
          hora_fin: '10:00',
          efecto_asistencia: 'SIN_GOCE',
        },
        {
          id: 'sol-3',
          tipo: 'PERMISO',
          estado: 'PENDIENTE',
          fecha_inicio: '2026-10-05',
          fecha_fin: '2026-10-05',
          hora_inicio: '09:00',
          hora_fin: '11:00',
          efecto_asistencia: 'CON_GOCE',
        },
        {
          id: 'sol-4',
          tipo: 'LICENCIA_MEDICA',
          estado: 'APROBADA',
          fecha_inicio: '2026-10-05',
          fecha_fin: '2026-10-05',
          hora_inicio: null,
          hora_fin: null,
          efecto_asistencia: 'CON_GOCE',
        },
        {
          id: 'sol-5',
          tipo: 'LICENCIA_MEDICA',
          estado: 'APROBADA',
          fecha_inicio: '2026-10-05',
          fecha_fin: '2026-10-05',
          hora_inicio: null,
          hora_fin: null,
          efecto_asistencia: 'SUBSIDIO',
        },
      ];
      contexto.solicitudes = solicitudes;
      const r = crearResultadoBase('2026-10-05');
      r.marcas = [{ tipo: 'ENTRADA', hora: '08:00' }];

      // Act
      const diasMedicos = diasMedicosAcumulados(solicitudes, '2026-10-05');
      const preparadas = prepararJustificaciones(contexto, '2026-10-05', r);
      const decisionAusencia = aplicarDecisionAusencia(
        [{ fecha: '2026-10-05', tipo: 'AUSENCIA', motivo: 'Falla eléctrica', datos: { resultado: 'INTERRUPCION_TECNICA' } }],
        r,
        preparadas.conGoce,
        preparadas.sinGoce,
      );

      // Assert
      expect(intervaloSolicitud(solicitudes[1])).toEqual([480, 600]);
      expect(diasMedicos).toBe(22);
      expect(r.alertas).toContain('SOLICITUD_PENDIENTE_DE_RESOLUCION');
      expect(r.alertas).toContain('LIMITE_ANUAL_DE_VEINTE_DIAS_MEDICOS_SUPERADO');
      expect(r.alertas).toContain('SUBSIDIO_REQUIERE_LIQUIDACION_ESPECIFICA');
      expect(r.alertas).toContain('JUSTIFICACIONES_CON_EFECTOS_SUPERPUESTOS');
      expect(r.alertas).toContain('DECISION_DE_AUSENCIA_INCOMPATIBLE_CON_MARCACIONES');
      expect(decisionAusencia?.tipo).toBe('AUSENCIA');
    });
  });

  describe('preparar-dia.ts, evaluar-ausencia.ts y evaluar-marcaciones.ts', () => {
    it('debería preparar un día laboral, validar correcciones de marcación y evaluar descansos', () => {
      // Arrange
      const contexto = crearContextoBase();
      const rSinIngreso = crearResultadoBase('2026-10-05');
      const rSinJornada = crearResultadoBase('2026-10-05');

      // Act & Assert: Sin fecha de ingreso
      expect(prepararDia({ ...contexto, empleado: { ...contexto.empleado, fecha_inicio: null } }, '2026-10-05', rSinIngreso)).toBeNull();
      expect(rSinIngreso.alertas).toContain('FECHA_DE_INGRESO_NO_REGISTRADA');

      // Act & Assert: Sin jornada histórica
      expect(prepararDia({ ...contexto, jornadas: [] }, '2026-10-05', rSinJornada)).toBeNull();
      expect(rSinJornada.alertas).toContain('JORNADA_HISTORICA_NO_ASIGNADA');

      // Act & Assert: Decisión de marcaciones inválida
      const rInvalido = crearResultadoBase('2026-10-05');
      expect(() =>
        prepararDia(
          {
            ...contexto,
            decisiones: [{ fecha: '2026-10-05', tipo: 'MARCACIONES', motivo: 'Corrección', datos: { marcaciones: [{ tipo: 'INVALIDO' }] } }],
          },
          '2026-10-05',
          rInvalido,
        ),
      ).toThrow(RangeError);

      // Act & Assert: Evaluación de descanso con trabajo y con licencia sin goce
      const rDescanso = crearResultadoBase('2026-10-04');
      rDescanso.marcas = [{ tipo: 'ENTRADA', hora: '09:00' }];
      evaluarDescanso(contexto, '2026-10-04', rDescanso, 'Feriado Local', []);
      expect(rDescanso.estado).toBe('FERIADO_O_DESCANSO_ACORDADO');
      expect(rDescanso.alertas).toContain('TRABAJO_EN_DESCANSO_REQUIERE_LIQUIDACION_ESPECIFICA');

      const rDescansoSinGoce = crearResultadoBase('2026-10-04');
      evaluarDescanso(
        contexto,
        '2026-10-04',
        rDescansoSinGoce,
        undefined,
        [{ fecha: '2026-10-04', tipo: 'AUSENCIA', motivo: 'Licencia', datos: { resultado: 'SIN_GOCE' } }],
      );
      expect(rDescansoSinGoce.estado).toBe('AUSENCIA_SIN_GOCE');
      expect(rDescansoSinGoce.sin_goce).toBe(1);
    });

    it('debería evaluar ausencias justificadas, sin goce, faltas injustificadas y ausencias pendientes', () => {
      // Arrange
      const programado: [number, number][] = [[480, 780], [840, 1020]];
      const rJustificada = crearResultadoBase('2026-10-05');
      const rSinGoce = { ...crearResultadoBase('2026-10-05'), minutos_sin_goce: 480 };
      const rFalta = crearResultadoBase('2026-10-05');
      const rPendiente = crearResultadoBase('2026-10-05');

      // Act
      evaluarAusencia(rJustificada, programado, [[0, 1440]], [], undefined, []);
      evaluarAusencia(rSinGoce, programado, [], [[0, 1440]], undefined, []);
      evaluarAusencia(
        rFalta,
        programado,
        [],
        [],
        { fecha: '2026-10-05', tipo: 'AUSENCIA', motivo: 'Inasistencia', datos: { resultado: 'FALTA_INJUSTIFICADA' } },
        [],
      );
      evaluarAusencia(rPendiente, programado, [], [], undefined, []);

      // Assert
      expect(rJustificada.estado).toBe('JUSTIFICADA');
      expect(rSinGoce.estado).toBe('AUSENCIA_SIN_GOCE');
      expect(rSinGoce.sin_goce).toBe(1);
      expect(rFalta.estado).toBe('FALTA_INJUSTIFICADA');
      expect(rFalta.falta).toBe(1);
      expect(rPendiente.estado).toBe('AUSENCIA_PENDIENTE');
      expect(rPendiente.alertas).toContain('AUSENCIA_REQUIERE_VERIFICACION');
    });

    it('debería evaluar marcaciones con tardanza inicial, tardanza en retorno de refrigerio y sobretiempo 25%/35%', () => {
      // Arrange
      const contexto = crearContextoBase();
      const horario = contexto.jornadas[0].horario[0];
      const jornada: JornadaHistorica = {
        ...contexto.jornadas[0],
        tolerancia_minutos: 5,
        politica_tolerancia: 'EXCESO',
      };
      const programado: [number, number][] = [[480, 780], [840, 1020]];
      const r = crearResultadoBase('2026-10-05');
      r.marcas = [
        { tipo: 'ENTRADA', hora: '08:15' }, // 15 min tarde -> 10 min exceso
        { tipo: 'SALIDA_ALMUERZO', hora: '13:00' },
        { tipo: 'ENTRADA_ALMUERZO', hora: '14:10' }, // 10 min tarde retorno
        { tipo: 'SALIDA', hora: '19:30' }, // 150 min extra -> 120 al 25% y 30 al 35%
      ];

      // Act
      evaluarMarcaciones(
        r,
        horario,
        jornada,
        [{ fecha: '2026-10-05', tipo: 'SOBRETIEMPO', motivo: 'Cierre contable', datos: { reconocer: true } }],
        programado,
        [],
        [],
        [],
      );

      // Assert
      expect(r.estado).toBe('ASISTENCIA_REGISTRADA');
      expect(r.minutos_tardanza).toBe(20); // 10 exceso inicial + 10 retorno
      expect(r.minutos_extra_observados).toBe(150);
      expect(r.minutos_extra_25).toBe(120);
      expect(r.minutos_extra_35).toBe(30);
    });
  });

  describe('evaluar-dia.ts y calcular-asistencia.ts (Cálculo Mensual Determinista)', () => {
    it('debería calcular los días de vínculo laboral en meses completos y parciales', () => {
      // Arrange & Act & Assert
      expect(diasDeVinculo('2026-01-01', null, '2026-10')).toBe(30);
      expect(diasDeVinculo('2026-10-01', '2026-10-15', '2026-10')).toBe(15);
      expect(diasDeVinculo('2026-11-01', null, '2026-10')).toBe(0);
    });

    it('debería calcular el resumen mensual completo de asistencia consolidando marcas, feriados y licencias', () => {
      // Arrange
      const contexto = crearContextoBase();
      contexto.marcaciones = [
        {
          id: 'm-1',
          fecha_hora: '2026-10-05T13:00:00.000Z', // 08:00 Lima
          tipo_marcacion: 'ENTRADA',
          metodo: 'MANUAL',
        },
        {
          id: 'm-2',
          fecha_hora: '2026-10-05T22:00:00.000Z', // 17:00 Lima
          tipo_marcacion: 'SALIDA',
          metodo: 'MANUAL',
        },
      ];
      contexto.solicitudes = [
        {
          id: 's-sin-fecha',
          tipo: 'PERMISO',
          estado: 'PENDIENTE',
          fecha_inicio: null,
          fecha_fin: null,
          hora_inicio: null,
          hora_fin: null,
          efecto_asistencia: 'SIN_GOCE',
        },
        {
          id: 's-subsidio',
          tipo: 'LICENCIA_MEDICA',
          estado: 'APROBADA',
          fecha_inicio: '2026-10-06',
          fecha_fin: '2026-10-06',
          hora_inicio: null,
          hora_fin: null,
          efecto_asistencia: 'SUBSIDIO',
        },
      ];
      contexto.decisiones = [
        {
          fecha: '2026-10-07',
          tipo: 'AUSENCIA',
          motivo: 'Falta verificada',
          datos: { resultado: 'FALTA_INJUSTIFICADA' },
        },
      ];

      // Act
      const resultado = calcularAsistencia(contexto);
      const diaLunes = resultado.detalle.find((d) => d.fecha === '2026-10-05');
      const diaFeriado = resultado.detalle.find((d) => d.fecha === '2026-10-08'); // Combate de Angamos
      const diaDomingo = resultado.detalle.find((d) => d.fecha === '2026-10-04'); // Domingo descanso

      // Assert
      expect(resultado.version_motor).toBe(VERSION_MOTOR_ASISTENCIA);
      expect(resultado.dias_vinculo).toBe(30);
      expect(resultado.faltas).toBe(1);
      expect(resultado.dias_trabajados).toBe(29);
      expect(diaLunes?.estado).toBe('ASISTENCIA_REGISTRADA');
      expect(diaLunes?.minutos_trabajados).toBe(480);
      expect(diaFeriado?.estado).toBe('FERIADO_O_DESCANSO_ACORDADO');
      expect(diaDomingo?.estado).toBe('DESCANSO_SEMANAL');
      expect(resultado.detalle[0].alertas).toContain('SOLICITUD_DE_ASISTENCIA_SIN_FECHAS');
      expect(resultado.detalle[0].alertas).toContain('INCAPACIDAD_MEDICA_REQUIERE_REVISION_DE_SUBSIDIOS');
    });

    it('debería marcar como NO_EVALUADO un día cuya hora de salida aún no se ha cumplido respecto a contexto.ahora', () => {
      // Arrange
      const contexto = crearContextoBase();
      contexto.ahora = '2026-10-05T15:00:00.000Z'; // 10:00 AM en Lima (salida es 17:00)

      // Act
      const dia = evaluarFecha(contexto, '2026-10-05', [], new Map());

      // Assert
      expect(dia.estado).toBe('NO_EVALUADO');
    });
  });
});
