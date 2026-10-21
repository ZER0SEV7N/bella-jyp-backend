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
    const { incidencia, empleado, financiero } = await cargarFuentesPlanilla(tx, empleadoId, periodo);

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
        horas_diarias: '8',
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
                  tope_seguro: comision.remuneracion_maxima_asegurable?.toString() ?? null
              }
            : null,
        parametros: valores,
        ingresos_previos: ingresos.toString(),
        retenciones_hasta_corte: retenciones.toString(),
        gratificaciones_previas: sumarHistorial(cerradas, 'total_ingresos').toString(),
        meses_gratificacion: mesesGratificacion,
        adelantos_desembolsados: adelantos.toString(),
        bono_extraordinario: bono.toString(),
        descuento_autorizado: autorizado.toString(),
        descuento_dso: dso?.toString() ?? null
    };
    const cabecera = {
        nombre_completo: `${empleado.nombre ?? ''} ${empleado.apellido ?? ''}`.trim(),
        nro_documento: empleado.nro_documento,
        cargo: empleado.cargo.nombre,
        area: empleado.area.nombre,
        asignacion_familiar: empleado.asig_familiar,
        dias_laborados: incidencia.dias_trabajados,
        regimen_pension: pension
    };
    const empresa = {
        nombreEmpresa: process.env.EMPRESA_NOMBRE ?? null,
        ruc: process.env.EMPRESA_RUC ?? null,
        direccion: process.env.EMPRESA_DIRECCION ?? null
    };
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
        version_motor: VERSION_MOTOR_PLANILLA
    };
    return { entrada, cabecera, empresa, incidencia_version: incidencia.version, hash: huella(fuentes) };
}
