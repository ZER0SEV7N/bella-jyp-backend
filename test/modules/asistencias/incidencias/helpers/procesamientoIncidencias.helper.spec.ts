//test/modules/asistencias/incidencias/helpers/procesamientoIncidencias.helper.spec.ts
import { obtenerPeriodo, indexarMarcacionesPeru, evaluarDia, calcularDiasBase } from '@/modules/asistencia/use-cases/helper/procesamiento.helper';

/**
 * Suite de pruebas unitarias para los métodos de procesamiento de incidencias de asistencia.
 * Estas pruebas se centran en la lógica pura de los métodos, sin depender de la base de datos ni de servicios externos.
 * Se validan escenarios como el cálculo de días base, la indexación de marcaciones y la evaluación de faltas y tardanzas.
 */
describe('ProcesamientoIncidenciasHelper - Pruebas Unitarias de Lógica Pura', () => {
    describe('obtenerPeriodo()', () => {
        it('Debe desglosar correctamente el rango de fechas en UTC para un mes de 30 días', () => {
            //Arrange: Llamada al método con un período de septiembre de 2026 (30 días)
            const resultado = obtenerPeriodo('2026-09');

            //Assert: Validar que el resultado contenga los valores esperados
            expect(resultado.year).toBe(2026);
            expect(resultado.month).toBe(9);
            expect(resultado.diasDelMes).toBe(30);
            expect(resultado.fechaInicioMes.toISOString()).toBe('2026-09-01T00:00:00.000Z');
            expect(resultado.fechaFinMes.toISOString()).toBe('2026-09-30T23:59:59.000Z');
        });

        it('Debe calcular 28 días para febrero de un año no bisiesto', () => {
            //Arrange & Assert: Llamada al método con un período de febrero de 2026 (28 días)
            const resultado = obtenerPeriodo('2026-02');
            expect(resultado.diasDelMes).toBe(28);
        });
    });

    describe('indexarMarcacionesPeru() (Manejo de Zona Horaria UTC-5)', () => {
        it('Debe convertir una marcación UTC a minutos locales en Lima sin desfase de 5 horas', () => {
            //Arrange: Crear un array de asistencias con una marcación de entrada en UTC
            //13:10:00 UTC corresponde a las 08:10:00 AM en Lima (UTC-5)
            const asistencias = [{
                tipo_marcacion: 'ENTRADA',
                fecha_hora: new Date('2026-09-01T13:10:00.000Z'),
            }];

            //Act: Llamar al método para indexar las marcaciones
            const resultado = indexarMarcacionesPeru(asistencias);
            const marcasDia = resultado.get('2026-09-01');

            //Assert: Validar que la marcación se haya convertido correctamente a minutos locales
            expect(marcasDia).toBeDefined();
            expect(marcasDia).toHaveLength(1);
            //08:10 AM = 8 * 60 + 10 = 490 minutos
            expect(marcasDia![0].horaLocalMinutos).toBe(490);
        });

        it('Debe ignorar marcaciones que no sean de tipo ENTRADA', () => {
            //Arrange: Crear un array de asistencias con marcaciones de salida
            const asistencias = [
                { tipo_marcacion: 'SALIDA_REFRIGERIO', fecha_hora: new Date('2026-09-01T18:00:00.000Z') },
                { tipo_marcacion: 'SALIDA', fecha_hora: new Date('2026-09-01T22:00:00.000Z') },
            ];

            //Act: Llamar al método para indexar las marcaciones
            const resultado = indexarMarcacionesPeru(asistencias);
            
            //Assert: Validar que no se hayan indexado marcaciones de salida
            expect(resultado.size).toBe(0);
        });
    });

    describe('calcularDiasBase() (Reglas de Nómina Peruana Base 30)', () => {
        //Periodo de prueba: Septiembre 2026 (30 días)
        const periodo = obtenerPeriodo('2026-09');

        it('Debe otorgar 30 días base a un colaborador antiguo que no cesó en el mes', () => {
            //Arrange: Crear un objeto de empleado con fecha de inicio antes del mes y sin fecha de cese
            const emp = {
                fecha_inicio: new Date('2024-01-01'),
                fecha_cese: null
            };

            //Act & Assert: Llamar al método y validar que retorne 30 días base
            expect(calcularDiasBase(emp, periodo)).toBe(30);
        });

        it('Debe calcular proporcionalmente a 15 días si ingresó el día 16 del mes', () => {
            //Arrange: Crear un objeto de empleado con fecha de inicio el día 16 del mes
            const emp = {
                fecha_inicio: new Date('2026-09-16T00:00:00.000Z'),
                fecha_cese: null,
            };

            //Act & Assert: Llamar al método y validar que retorne 15 días base
            //30 - (16 - 1) = 15 días
            expect(calcularDiasBase(emp, periodo)).toBe(15);
        });

        it('Debe truncar a 10 días si cesó el día 10 del mes', () => {
            //Arrange: Crear un objeto de empleado con fecha de cese el día 10 del mes
            const emp = {
                fecha_inicio: new Date('2024-01-01'),
                fecha_cese: new Date('2026-09-10T23:59:59.000Z'),
            };

            //Act & Assert: Llamar al método y validar que retorne 10 días base
            //Del 1 al 10 = 10 días
            expect(calcularDiasBase(emp, periodo)).toBe(10);
        });

        it('Debe retornar 0 si el colaborador inicia su contrato el próximo mes', () => {
            //Arrange: Crear un objeto de empleado con fecha de inicio el próximo mes
            const emp = {
                fecha_inicio: new Date('2026-10-01T00:00:00.000Z'),
                fecha_cese: null,
            };

            //Act & Assert: Llamar al método y validar que retorne 0 días base
            expect(calcularDiasBase(emp, periodo)).toBe(0);
        });
    });

    describe('evaluarDia()', () => {
        //Periodo de prueba: Septiembre 2026 (30 días)
        const periodo = obtenerPeriodo('2026-09');
        //Horario semanal de prueba
        const horarioSemanal = [
            { dia: 'MARTES', laborable: true, entrada: '08:00', salida: '17:00' },
            { dia: 'DOMINGO', laborable: false, entrada: null, salida: null }
        ];

        it('Debe ignorar días no laborables según el horario semanal (0 faltas, 0 tardanzas)', () => {
            //Arrange: Crear un objeto de empleado sin fecha de inicio ni cese, y sin solicitudes
            //2026-09-06 fue Domingo
            const emp = { fecha_inicio: null, fecha_cese: null, solicitudes: [] };
            
            //Act: Llamar al método para evaluar el día no laborable
            const resultado = evaluarDia(emp, 6, periodo, horarioSemanal, new Map());

            //Assert: Validar que no se computen faltas ni tardanzas en un día no laborable
            expect(resultado).toEqual({ falta: 0, tardanza: 0 });
        });

        it('Debe computar 1 falta injustificada si era día laborable y no hay marcación', () => {
            //Arrange: Crear un objeto de empleado sin fecha de inicio ni cese, y sin solicitudes
            //2026-09-01 fue Martes
            const emp = { fecha_inicio: null, fecha_cese: null, solicitudes: [] };

            //Act: Llamar al método para evaluar el día laborable sin marcación
            const resultado = evaluarDia(emp, 1, periodo, horarioSemanal, new Map());

            //Assert: Validar que se compute 1 falta injustificada y 0 tardanzas
            expect(resultado).toEqual({ falta: 1, tardanza: 0 });
        });

        it('Debe justificar la inasistencia si coincide con una solicitud aprobada', () => {
            //Arrange: Crear un objeto de empleado con una solicitud aprobada que cubre el día 1 del mes
            const emp = {
                fecha_inicio: null,
                fecha_cese: null,
                solicitudes: [{
                    fecha_inicio: new Date('2026-09-01T00:00:00.000Z'),
                    fecha_fin: new Date('2026-09-05T23:59:59.000Z')
                }]
            };

            //Act: Llamar al método para evaluar el día laborable con solicitud aprobada
            const resultado = evaluarDia(emp, 1, periodo, horarioSemanal, new Map());

            //Assert: Validar que no se compute falta ni tardanza debido a la solicitud aprobada
            expect(resultado).toEqual({ falta: 0, tardanza: 0 });
        });

        it('Debe calcular minutos de tardanza si superó la tolerancia configurada', () => {
            //Arrange: Crear un objeto de empleado con tolerancia de 5 minutos y sin solicitudes
            //Programado: 08:00 (480m) | Marcó: 08:18 (498m) | Tolerancia: 5m => 18 minutos tardanza
            const emp = {
                fecha_inicio: null,
                fecha_cese: null,
                jornada: { tolerancia_minutos: 5 },
                solicitudes: []
            };

            //Act: Crear un mapa de marcaciones con la hora de entrada del día 1 del mes
            const marcaciones = new Map<string, { horaLocalMinutos: number }[]>();
            marcaciones.set('2026-09-01', [{ horaLocalMinutos: 498 }]);

            //Act: Llamar al método para evaluar el día laborable con marcación tardía
            const resultado = evaluarDia(emp, 1, periodo, horarioSemanal, marcaciones);

            //Assert: Validar que se compute 0 faltas y 18 minutos de tardanza
            expect(resultado.falta).toBe(0);
            expect(resultado.tardanza).toBe(18);
        });

        it('No debe computar tardanza si la llegada está dentro de la tolerancia', () => {
            //Arrange: Crear un objeto de empleado con tolerancia de 5 minutos y sin solicitudes
            //Programado: 08:00 (480m) | Marcó: 08:04 (484m) | Tolerancia: 5m => 0 tardanza
            const emp = {
                fecha_inicio: null,
                fecha_cese: null,
                jornada: { tolerancia_minutos: 5 },
                solicitudes: [],
            };

            //Crear un mapa de marcaciones con la hora de entrada del día 1 del mes
            const marcaciones = new Map<string, { horaLocalMinutos: number }[]>();
            marcaciones.set('2026-09-01', [{ horaLocalMinutos: 484 }]);

            //Act: Llamar al método para evaluar el día laborable con marcación dentro de la tolerancia
            const resultado = evaluarDia(emp, 1, periodo, horarioSemanal, marcaciones);

            //Assert: Validar que no se compute falta ni tardanza
            expect(resultado).toEqual({ falta: 0, tardanza: 0 });
        });
    });
});