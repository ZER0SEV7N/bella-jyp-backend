import {
  calcularAsistencia,
  diasDeVinculo,
} from '@/modules/asistencia/domain/calcular-asistencia';
import {
  contexto,
  entrada,
  horario,
  horario48,
  cambiarMarcas,
  dia,
  solicitud,
} from '../../../fixtures/motores.fixture';

describe('asistencia - Reglas aisladas del motor', () => {
  it('El mes completo tiene treinta días remunerables y ningún pendiente', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: calcular con las entradas preparadas.
    const r = calcularAsistencia(contexto());
    // Act: ejecutar la regla.
    const resultado1 = r.dias_vinculo;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(30);
    // Act: ejecutar la regla.
    const resultado2 = r.dias_trabajados;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(30);
    // Act: ejecutar la regla.
    const resultado3 = r.pendientes;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado3).toBe(0);
    // Act: ejecutar la regla.
    const resultado4 = r.completo;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado4).toBe(true);
  });

  it('El día 31 de ingreso representa un día, no cero', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: ejecutar la regla.
    const resultado1 = diasDeVinculo('2026-10-31', null, '2026-10');
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(1);
  });

  it('Febrero completo conserva treinta y un vínculo parcial conserva sus días efectivos', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: ejecutar la regla.
    const resultado1 = diasDeVinculo('2026-01-01', null, '2026-02');
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(30);
    // Act: ejecutar la regla.
    const resultado2 = diasDeVinculo('2026-02-15', '2026-02-28', '2026-02');
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(14);
  });

  it('Una entrada sin salida es una incidencia pendiente', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, [['ENTRADA', '09:00']]);
    // Act: ejecutar la regla.
    const resultado1 = dia(c).estado;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe('MARCACION_INCOMPLETA');
    // Act: ejecutar la regla.
    const resultado2 = dia(c).falta;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(0);
  });

  it('Una salida sin entrada tampoco se descuenta automáticamente como falta', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, [['SALIDA', '18:00']]);
    // Act: ejecutar la regla.
    const resultado1 = dia(c).estado;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe('MARCACION_INCOMPLETA');
    // Act: ejecutar la regla.
    const resultado2 = dia(c).falta;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(0);
  });

  it('La ausencia sin evidencia requiere verificación', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, []);
    // Act: ejecutar la regla.
    const resultado1 = dia(c).estado;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe('AUSENCIA_PENDIENTE');
    // Act: ejecutar la regla.
    const resultado2 = dia(c).falta;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(0);
  });

  it('RRHH puede confirmar la falta conservando las marcas originales', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, []);
    c.decisiones.push({
      fecha: '2026-09-01',
      tipo: 'AUSENCIA',
      datos: { resultado: 'FALTA_INJUSTIFICADA' },
      motivo: 'Ausencia verificada',
    });
    // Act: ejecutar la regla.
    const resultado1 = dia(c).falta;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(1);
    // Act: ejecutar la regla.
    const resultado2 = calcularAsistencia(c).dias_trabajados;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(29);
  });

  it('La tolerancia completa produce seis minutos a las 09:06', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, [
      ['ENTRADA', '09:06'],
      ['SALIDA', '18:00'],
    ]);
    // Act: ejecutar la regla.
    const resultado1 = dia(c).minutos_tardanza;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(6);
  });

  it('La política por exceso produce un minuto a las 09:06', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    c.jornadas[0].politica_tolerancia = 'EXCESO';
    cambiarMarcas(c, [
      ['ENTRADA', '09:06'],
      ['SALIDA', '18:00'],
    ]);
    // Act: ejecutar la regla.
    const resultado1 = dia(c).minutos_tardanza;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(1);
  });

  it('Un permiso por horas no borra el sobretiempo del resto del día', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, [
      ['ENTRADA', '10:00'],
      ['SALIDA', '19:00'],
    ]);
    c.solicitudes.push(solicitud('CON_GOCE'));
    // Act: ejecutar la regla.
    const resultado1 = dia(c).minutos_tardanza;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(0);
    // Act: ejecutar la regla.
    const resultado2 = dia(c).minutos_extra_observados;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(60);
  });

  it('Un permiso parcial sin goce solo descuenta el intervalo autorizado', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, [
      ['ENTRADA', '10:00'],
      ['SALIDA', '18:00'],
    ]);
    c.solicitudes.push(solicitud('SIN_GOCE'));
    // Act: ejecutar la regla.
    const resultado1 = dia(c).minutos_tardanza;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(0);
    // Act: ejecutar la regla.
    const resultado2 = dia(c).minutos_sin_goce;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(60);
  });

  it('Un permiso sin goce que coincide con trabajo exige revisión', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    c.solicitudes.push(solicitud('SIN_GOCE'));
    // Act: ejecutar la regla.
    const resultado1 = dia(c).alertas.includes(
      'PERMISO_SIN_GOCE_COINCIDE_CON_TRABAJO'
    );
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBeTruthy();
  });

  it('El día entero sin goce no vuelve a descontarse como minutos', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, []);
    c.solicitudes.push(solicitud('SIN_GOCE', null, null));
    // Act: ejecutar la regla.
    const resultado1 = dia(c).sin_goce;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(1);
    // Act: ejecutar la regla.
    const resultado2 = dia(c).minutos_sin_goce;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(0);
  });

  it('Las solicitudes pendientes bloquean la aprobación', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    c.solicitudes.push({ ...solicitud('CON_GOCE'), estado: 'EN_REVISION' });
    // Act: ejecutar la regla.
    const resultado1 = dia(c).alertas.includes(
      'SOLICITUD_PENDIENTE_DE_RESOLUCION'
    );
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBeTruthy();
  });

  it('Una licencia subsidiada requiere su liquidación específica', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    c.solicitudes.push({
      ...solicitud('SUBSIDIO'),
      tipo: 'LICENCIA_MEDICA',
    });
    // Act: ejecutar la regla.
    const resultado1 = dia(c).alertas.includes(
      'SUBSIDIO_REQUIERE_LIQUIDACION_ESPECIFICA'
    );
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBeTruthy();
  });

  it('Las cuatro marcas permiten identificar retorno tardío del refrigerio', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, [
      ['ENTRADA', '09:00'],
      ['SALIDA_ALMUERZO', '13:00'],
      ['ENTRADA_ALMUERZO', '14:07'],
      ['SALIDA', '18:00'],
    ]);
    // Act: ejecutar la regla.
    const resultado1 = dia(c).minutos_tardanza;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(7);
    // Act: ejecutar la regla.
    const resultado2 = dia(c).minutos_salida_anticipada;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(0);
  });

  it('La salida anticipada conserva sus minutos exactos', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, [
      ['ENTRADA', '09:00'],
      ['SALIDA', '17:50'],
    ]);
    // Act: ejecutar la regla.
    const resultado1 = dia(c).minutos_salida_anticipada;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(10);
  });

  it('Catorce minutos de sobretiempo observado no desaparecen', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, [
      ['ENTRADA', '09:00'],
      ['SALIDA', '18:14'],
    ]);
    c.decisiones.push({
      fecha: '2026-09-01',
      tipo: 'SOBRETIEMPO',
      datos: { reconocer: true },
      motivo: 'Trabajo adicional verificado',
    });
    // Act: ejecutar la regla.
    const resultado1 = dia(c).minutos_extra_25;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(14);
  });

  it('El sobretiempo anterior al ingreso también se observa', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, [
      ['ENTRADA', '08:40'],
      ['SALIDA', '18:00'],
    ]);
    // Act: ejecutar la regla.
    const resultado1 = dia(c).minutos_extra_observados;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(20);
  });

  it('Las dos primeras horas adicionales se separan por día', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, [
      ['ENTRADA', '09:00'],
      ['SALIDA', '20:10'],
    ]);
    c.decisiones.push({
      fecha: '2026-09-01',
      tipo: 'SOBRETIEMPO',
      datos: { reconocer: true },
      motivo: 'Trabajo adicional verificado',
    });
    // Act: ejecutar la regla.
    const resultado1 = dia(c).minutos_extra_25;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(120);
    // Act: ejecutar la regla.
    const resultado2 = dia(c).minutos_extra_35;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(10);
  });

  it('Una jornada no terminada no genera falta', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    c.ahora = '2026-09-01T15:00:00Z';
    cambiarMarcas(c, []);
    // Act: ejecutar la regla.
    const resultado1 = dia(c).estado;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe('NO_EVALUADO');
    // Act: ejecutar la regla.
    const resultado2 = calcularAsistencia(c).completo;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(false);
  });

  it('Una modalidad remota se conserva en el detalle', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    // Act: ejecutar la regla.
    const resultado1 = dia(contexto()).modalidad;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe('REMOTO');
  });

  it('El día médico veintiuno no se paga automáticamente como licencia ordinaria', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    cambiarMarcas(c, []);
    c.solicitudes.push({
      ...solicitud('CON_GOCE', null, null),
      tipo: 'LICENCIA_MEDICA',
    });
    c.solicitudes.push({
      ...solicitud('CON_GOCE', null, null),
      id: 'medica-anterior',
      tipo: 'LICENCIA_MEDICA',
      fecha_inicio: '2026-08-11',
      fecha_fin: '2026-08-30',
    });
    // Act: ejecutar la regla.
    const resultado1 = dia(c).alertas.includes(
      'LIMITE_ANUAL_DE_VEINTE_DIAS_MEDICOS_SUPERADO'
    );
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBeTruthy();
  });

  it('Un sábado laborable se evalúa con las mismas reglas que el resto de días', () => {
    // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
    const c = contexto();
    c.jornadas[0].horario = horario48();
    c.jornadas[0].minutos_semana = 2880;
    for (const [tipo, hora] of [
      ['ENTRADA', '09:00'],
      ['SALIDA', '18:00'],
    ])
      c.marcaciones.push({
        id: tipo,
        tipo_marcacion: tipo,
        fecha_hora: `2026-09-05T${hora}:00-05:00`,
        metodo: 'MANUAL',
      });
    // Act: calcular con las entradas preparadas.
    const sabado = calcularAsistencia(c).detalle.find(
      (d) => d.fecha === '2026-09-05'
    );
    // Act: ejecutar la regla.
    const resultado1 = sabado.minutos_programados;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado1).toBe(480);
    // Act: ejecutar la regla.
    const resultado2 = sabado.minutos_trabajados;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado2).toBe(480);
    // Act: ejecutar la regla.
    const resultado3 = sabado.alertas.length;
    // Assert: comprobar el resultado esperado del escenario.
    expect(resultado3).toBe(0);
  });
});
