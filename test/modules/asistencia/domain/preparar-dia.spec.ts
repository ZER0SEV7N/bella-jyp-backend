import {
  prepararDia,
  evaluarDescanso,
} from '@/modules/asistencia/domain/preparar-dia';
import { contexto, solicitud } from '../../../fixtures/motores.fixture';

/** Cada caso usa un resultado nuevo para evitar estado compartido entre días. */
const resultado = (): any => ({
  fecha: '2026-09-01',
  estado: 'PENDIENTE',
  marcas: [],
  alertas: [],
  sin_goce: 0,
});
describe('Preparación del día de asistencia', () => {
  it.each([
    ['sin ingreso', { fecha_inicio: null }, 'FECHA_DE_INGRESO_NO_REGISTRADA'],
    ['antes de ingresar', { fecha_inicio: '2026-09-02' }, null],
    ['después del cese', { fecha_cese: '2026-08-31' }, null],
  ])('omite evaluación %s', (_nombre, cambio, alerta) => {
    // Arrange: fecha fuera del vínculo o legajo incompleto.
    const ctx = contexto();
    Object.assign(ctx.empleado, cambio);
    const r = resultado();
    // Act: preparar el primer día.
    const preparado = prepararDia(ctx, r.fecha, r);
    // Assert: no fabricar un horario ni marcar falta sin vínculo.
    expect(preparado).toBeNull();
    expect(r.alertas).toEqual(alerta ? [alerta] : []);
  });
  it.each([
    ['sin jornada', [], 'JORNADA_HISTORICA_NO_ASIGNADA'],
    [
      'sin horario',
      [{ desde: '2026-09-01', horario: [] }],
      'HORARIO_NO_CONFIGURADO',
    ],
  ])('detecta configuración %s', (_nombre, jornadas, alerta) => {
    // Arrange: configuración histórica incompleta.
    const ctx = contexto();
    ctx.jornadas = jornadas as any;
    const r = resultado();
    // Act: intentar preparar el día.
    const preparado = prepararDia(ctx, r.fecha, r);
    // Assert: el dato faltante aparece como alerta.
    expect(preparado).toBeNull();
    expect(r.alertas).toContain(alerta);
  });
  it.each([
    null,
    {},
    [null],
    ['texto'],
    [{ tipo: 'OTRO', hora: '09:00' }],
    [{ tipo: 'ENTRADA', hora: 9 }],
    [{ tipo: 'ENTRADA', hora: '09:00', id: 1 }],
    [{ tipo: 'ENTRADA', hora: '09:00', origen: 1 }],
  ])('rechaza corrección de marcas mal formada %j', (marcas) => {
    // Arrange: la decisión persistida puede provenir de versiones anteriores del contrato.
    const ctx = contexto();
    ctx.decisiones = [
      {
        fecha: '2026-09-01',
        tipo: 'MARCACIONES',
        datos: { marcaciones: marcas },
      },
    ] as any;
    // Act / Assert: el dominio también impide procesar datos inválidos.
    expect(() => prepararDia(ctx, '2026-09-01', resultado())).toThrow(
      'formato válido'
    );
  });
  it('usa las marcas corregidas y la modalidad por defecto sin modificar las originales', () => {
    // Arrange: modalidad omitida y decisión válida con ID y origen opcionales.
    const ctx = contexto();
    ctx.jornadas[0].horario = ctx.jornadas[0].horario.map((h) => ({
      ...h,
      modalidad: undefined,
    }));
    const marcas = [
      { tipo: 'ENTRADA', hora: '09:00', id: 'nueva', origen: 'RRHH' },
      { tipo: 'SALIDA', hora: '18:00' },
    ];
    ctx.decisiones = [
      {
        fecha: '2026-09-01',
        tipo: 'MARCACIONES',
        datos: { marcaciones: marcas },
      },
    ] as any;
    const originales = JSON.stringify(ctx.marcaciones);
    const r = resultado();
    // Act: preparar usando la decisión vigente.
    prepararDia(ctx, r.fecha, r);
    // Assert: usar la corrección para calcular y mantener el registro biométrico.
    expect(r.marcas).toEqual(marcas);
    expect(r.modalidad).toBe('PRESENCIAL');
    expect(JSON.stringify(ctx.marcaciones)).toBe(originales);
  });
});
describe('Descanso y ausencia sin goce', () => {
  it.each([
    { estado: 'PENDIENTE' },
    { efecto_asistencia: 'CON_GOCE' },
    { hora_inicio: '09:00' },
    { fecha_inicio: null },
    { fecha_fin: null },
    { fecha_inicio: '2026-09-02' },
    { fecha_fin: '2026-08-31' },
  ])(
    'no convierte una solicitud parcial o ajena al día en ausencia completa: %j',
    (cambio) => {
      // Arrange: partir de una solicitud de día completo y variar un requisito.
      const ctx = contexto();
      ctx.solicitudes = [
        { ...solicitud('SIN_GOCE', null, null), ...cambio },
      ] as any;
      // Act: evaluar el descanso sin marcaciones.
      const r = evaluarDescanso(ctx, '2026-09-01', resultado(), undefined, []);
      // Assert: no descontar un día sin aprobación o sin cobertura completa.
      expect(r.estado).toBe('DESCANSO_SEMANAL');
      expect(r.sin_goce).toBe(0);
    }
  );
  it('respeta licencia sin goce completa que cubre un feriado', () => {
    // Arrange: permiso aprobado que abarca la fecha completa.
    const ctx = contexto();
    ctx.solicitudes = [solicitud('SIN_GOCE', null, null)];
    // Act: evaluar un feriado incluido en la licencia.
    const r = evaluarDescanso(ctx, '2026-09-01', resultado(), 'FERIADO', []);
    // Assert: el día conserva su efecto sin goce.
    expect(r.estado).toBe('AUSENCIA_SIN_GOCE');
    expect(r.sin_goce).toBe(1);
  });
  it('respeta la decisión de ausencia sin goce', () => {
    // Arrange: decisión expresa y sin marcas físicas.
    const decisiones: any = [
      { tipo: 'AUSENCIA', datos: { resultado: 'SIN_GOCE' } },
    ];
    // Act: aplicar la decisión.
    const r = evaluarDescanso(
      contexto(),
      '2026-09-01',
      resultado(),
      undefined,
      decisiones
    );
    // Assert: generar un solo día sin goce.
    expect(r.sin_goce).toBe(1);
  });
  it('genera alerta si se trabaja un feriado y no aplica ausencia completa', () => {
    // Arrange: hay marca física aunque exista permiso sin goce.
    const ctx = contexto();
    ctx.solicitudes = [solicitud('SIN_GOCE', null, null)];
    const r = resultado();
    r.marcas = [{ tipo: 'ENTRADA', hora: '09:00' }];
    // Act: evaluar el trabajo en descanso.
    evaluarDescanso(ctx, r.fecha, r, 'FERIADO', []);
    // Assert: requerir revisión específica y no descontar automáticamente.
    expect(r.estado).toBe('FERIADO_O_DESCANSO_ACORDADO');
    expect(r.sin_goce).toBe(0);
    expect(r.alertas).toContain(
      'TRABAJO_EN_DESCANSO_REQUIERE_LIQUIDACION_ESPECIFICA'
    );
  });
});
