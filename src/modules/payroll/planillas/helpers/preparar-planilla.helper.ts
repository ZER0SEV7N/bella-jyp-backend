//src/modules/payroll/planillas/helpers/preparar-planilla.helper.ts
import { ServerTime } from '@/common/utils/server-time';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { VERSION_MOTOR_PLANILLA } from '../domain/calcular-planilla';
import type { EntradaPlanilla } from '../domain/planilla.types';
import { cargarFuentesPlanilla } from './fuentes-planilla.helper';
import { obtenerMesesGratificacion } from './gratificacion-planilla.helper';
import { cargarHistorialPlanilla, sumarHistorial } from './historial-planilla.helper';
import { cargarNovedadesPlanilla } from './novedades-planilla.helper';
import { cargarParametrosPlanilla } from './parametros-planilla.helper';
import { cargarPensionPlanilla } from './pension-planilla.helper';
import { ConflictException } from '@nestjs/common';
import { ContextoAsistencia } from '@/modules/asistencia/domain/asistencia.types';
import { Dinero } from '../domain/dinero-planilla';
import { minutosEfectivos } from '@/modules/asistencia/domain/validar-jornada';

/**
 * Helper para la preparación de la planilla de un empleado para un periodo determinado.
 * Este helper carga todas las fuentes de datos necesarias, calcula los valores de la planilla y genera un hash de verificación.
 * Su objetivo es garantizar que la planilla se pueda congelar y verificar posteriormente, asegurando la integridad de los datos.
 */

//Cada dato que afecta el resultado participa en la huella y se vuelve a verificar al congelar.
const huella = (datos: unknown) => createHash('sha256').update(JSON.stringify(datos)).digest('hex');

/**
 * Prepara la planilla de un empleado para un periodo determinado.
 * @param tx - Cliente de transacción de Prisma.
 * @param empleadoId - ID del empleado.
 * @param periodo - Periodo en formato 'YYYY-MM'.
 * @returns Un objeto con la entrada de la planilla, cabecera, empresa, versión de incidencia y huella.
 */
export async function prepararPlanilla(tx: Prisma.TransactionClient, empleadoId: string, periodo: string) {
    //Validar el periodo y obtener el año y mes correspondientes
    const { year, month } = ServerTime.validarPeriodo(periodo);

    //Cargar todas las fuentes de datos necesarias para la preparación de la planilla
    const { incidencia, empleado, financiero, contexto } = await cargarFuentesPlanilla(tx, empleadoId, periodo);

    //Obtener la fecha de referencia para la carga de parámetros y pensión
    const referencia = new Date(Date.UTC(year, month, 0));

    //Cargar los parámetros de la planilla, pensión y comisiones, historial de ingresos y retenciones, y novedades
    const { parametros, valores } = await cargarParametrosPlanilla(tx, referencia, periodo);
    const { pension, esOnp, comisiones } = await cargarPensionPlanilla(tx, financiero, referencia);
    const { cerradas, ingresos, retenciones } = await cargarHistorialPlanilla(tx, empleadoId, periodo, empleado.fecha_inicio);
    const { pagos, aprobadas, adelantos, bono, autorizado, dso } = await cargarNovedadesPlanilla(tx, empleadoId, periodo);

    //Seleccionar la primera comisión si existe
    const comision = comisiones[0];

    //Calcular los meses de gratificación y preparar la entrada de la planilla
    const mesesGratificacion = obtenerMesesGratificacion(periodo, empleado, incidencia, cerradas);

    //Preparar la entrada de la planilla con todos los datos necesarios
    const entrada: EntradaPlanilla = {
        periodo,
        empleado_id: empleadoId,
        sueldo_basico: financiero.sueldo_basico.toString(),
        asignacion_familiar: empleado.asig_familiar,
        dias_vinculo: incidencia.dias_vinculo,
        dias_remunerables: incidencia.dias_trabajados,
        faltas: incidencia.faltas,
        dias_sin_goce: incidencia.dias_sin_goce,
        minutos_tardanza: incidencia.minutos_tardanza,
        minutos_salida_anticipada: incidencia.minutos_salida_anticipada,
        minutos_sin_goce: incidencia.minutos_sin_goce,
        minutos_extras_25: incidencia.minutos_extras_25,
        minutos_extras_35: incidencia.minutos_extras_35,
        horas_diarias: horasDiariasPlanilla(contexto),
        regimen: esOnp ? 'ONP' : 'AFP',
        tipo_comision: financiero.tipo_comision,
        regimen_salud: financiero.regimen_salud,
        eps_adicional: financiero.eps_costo_adicional?.toString() ?? '0',
        afp: comision
        ? {
            aporte: comision.aporte_obligatorio.toString(),
            prima: comision.prima_seguro.toString(),
            flujo: comision.comision_sobre_ra.toString(),
            flujo_mixta: comision.comision_flujo_mixta?.toString() ?? null,
            tope_seguro: comision.remuneracion_maxima_asegurable?.toString() ?? null,
        } : null,
        parametros: valores,
        ingresos_previos: ingresos.toString(),
        retenciones_hasta_corte: retenciones.toString(),
        gratificaciones_previas: sumarHistorial(cerradas, 'total_ingresos').toString(),
        meses_gratificacion: mesesGratificacion,
        adelantos_desembolsados: adelantos.toString(),
        bono_extraordinario: bono.toString(),
        descuento_autorizado: autorizado.toString(),
        descuento_dso: dso?.toString() ?? null,
    };

    //Preparar la cabecera de la planilla con los datos del empleado y su régimen de pensión
    const cabecera = {
        nombre_completo: `${empleado.nombre ?? ''} ${empleado.apellido ?? ''}`.trim(),
        nro_documento: empleado.nro_documento,
        cargo: empleado.cargo.nombre,
        area: empleado.area.nombre,
        asignacion_familiar: empleado.asig_familiar,
        dias_laborados: incidencia.dias_trabajados,
        regimen_pension: pension,
    };

    //Preparar los datos de la empresa a partir de las variables de entorno, permitiendo que sean nulos si no están definidos
    const empresa = {
        nombreEmpresa: process.env.EMPRESA_NOMBRE ?? null,
        ruc: process.env.EMPRESA_RUC ?? null,
        direccion: process.env.EMPRESA_DIRECCION ?? null,
    };

    //Generar la huella de verificación de todas las fuentes de datos que afectan el cálculo de la planilla
    const fuentes = {
        entrada,
        cabecera,
        empresa,
        incidencia_version: incidencia.version,
        asistencia_hash: incidencia.fuente_hash,
        parametros: parametros.map((p) => ({ id: p.id, valor: p.valor.toString() })),
        comisiones: comisiones.map((c) => c.id),
        desembolsos: pagos.map((p) => p.id),
        novedades: aprobadas.map((n) => ({ id: n.id, version: n.version, tipo: n.tipo, monto: n.monto.toString() })),
        version_motor: VERSION_MOTOR_PLANILLA,
    };

    //Devuelve un objeto con la entrada de la planilla, cabecera, empresa, versión de incidencia y huella de verificación
    return { entrada, cabecera, empresa, incidencia_version: incidencia.version, hash: huella(fuentes) };
}

/**
 * Calcula las horas diarias uniformes de la jornada del empleado para el periodo especificado.
 * Si la jornada no es uniforme, lanza una excepción de conflicto indicando que los cambios de duración deben liquidarse por tramos.
 * @param contexto - Contexto de asistencia del empleado para el periodo.
 * @returns Las horas diarias uniformes como cadena decimal.
 * @throws ConflictException si la jornada no es uniforme y requiere liquidación por tramos.
 */
export function horasDiariasPlanilla(contexto: ContextoAsistencia): string {
    //Calcula el inicio del periodo y filtra las jornadas para obtener la anterior y las vigentes
    const inicio = `${contexto.periodo}-01`;
    
    //Filtra las jornadas para obtener la jornada anterior y las vigentes, asegurando que la jornada diaria sea uniforme
    const anterior = contexto.jornadas.filter((jornada) => jornada.desde <= inicio).at(-1);
    //Filtra las jornadas para obtener las vigentes, asegurando que la jornada diaria sea uniforme
    const vigencias = contexto.jornadas.filter((jornada) => jornada.desde > inicio);

    //Si existe una jornada anterior, la agrega al inicio de las vigencias para asegurar que se considere en el cálculo de horas diarias
    if (anterior) 
        vigencias.unshift(anterior);
    
    //Calcula los minutos efectivos de cada jornada y verifica que todos sean iguales, asegurando que la jornada diaria sea uniforme
    const minutos = new Set(vigencias.flatMap((jornada) => jornada.horario.filter((dia) => dia.laborable).map(minutosEfectivos)));
    if (minutos.size !== 1) 
        throw new ConflictException('El período requiere una jornada diaria uniforme; los cambios de duración deben liquidarse por tramos.');
    
    //Convierte los minutos efectivos a horas diarias uniformes utilizando la clase Dinero y devuelve el resultado como cadena decimal
    return new Dinero([...minutos][0]).div(60).toString();
}
