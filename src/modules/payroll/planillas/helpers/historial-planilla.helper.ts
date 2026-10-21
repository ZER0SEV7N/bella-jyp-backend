//src/modules/payroll/planillas/helpers/historial-planilla.helper.ts
import { ServerTime } from '@/common/utils/server-time';
import { ConflictException } from '@nestjs/common';
import type { historial_planillas } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { corteRetencionesQuinta } from '../domain/calcular-planilla';

/** 
 * Helper para cargar el historial de planillas de un empleado en un periodo determinado.
 * Este helper verifica que existan los acumulados previos necesarios antes de calcular la planilla.
 * Su objetivo es garantizar que la planilla se pueda calcular correctamente, asegurando la integridad de los datos.
 */

//Funcion para sumar los valores de un campo específico en un arreglo de historial_planillas
//Devuelve un objeto con las filas cerradas, el total de ingresos y el total de retenciones de quinta
export function sumarHistorial(filas: historial_planillas[], campo: 'descuento_quinta' | 'total_ingresos') {
    return filas.reduce((total, fila) => total.add(fila[campo]), new Prisma.Decimal(0));
}

/**
 * Funcion Asincronica para cargar el historial de planillas de un empleado en un periodo determinado.
 * Verifica que existan los acumulados previos necesarios antes de calcular la planilla.
 * @param tx - Cliente de transacción de Prisma.
 * @param empleadoId - ID del empleado para el cual se está cargando el historial.
 * @param periodo - Periodo en formato 'YYYY-MM' para el cual se está cargando el historial.
 * @param fechaInicio - Fecha de inicio del vínculo laboral del empleado.
 * @returns - Un objeto que contiene las filas cerradas, el total de ingresos y el total de retenciones de quinta.
 */
export async function cargarHistorialPlanilla(tx: Prisma.TransactionClient, empleadoId: string, periodo: string, fechaInicio: Date) {
    //Validar el periodo y obtener el año y mes correspondientes
    const { year, month } = ServerTime.validarPeriodo(periodo);
    const anteriores = await tx.historial_planillas.findMany({
        where: { empleado_id: empleadoId, periodo: { gte: `${year}-01`, lt: periodo }, deleted_at: null },
        orderBy: { periodo: 'asc' }
    });

    //Verificar que existan los acumulados previos necesarios antes de calcular la planilla
    const primerMes = Math.max(1, fechaInicio.getUTCFullYear() === year ? fechaInicio.getUTCMonth() + 1 : 1);
    
    //Verificar que existan los acumulados previos necesarios antes de calcular la planilla
    for (let mes = primerMes; mes < month; mes++) {
        const texto = `${year}-${String(mes).padStart(2, '0')}`;
        if (!anteriores.some((p) => p.periodo === texto && ['CONGELADO', 'DECLARADO'].includes(p.estado)))
            throw new ConflictException(`Falta el historial congelado de ${texto}. Debe registrar los acumulados previos antes de calcular ${periodo}.`);
    }

    //Filtrar las filas cerradas (CONGELADO o DECLARADO) del historial de planillas
    const cerradas = anteriores.filter((p) => ['CONGELADO', 'DECLARADO'].includes(p.estado));

    //Calcular el corte de retenciones de quinta según el mes del periodo actual
    const corte = corteRetencionesQuinta(month).hastaMes;
    const retenciones = sumarHistorial(
        cerradas.filter((p) => Number(p.periodo.slice(5)) <= corte),
        'descuento_quinta'
    );

    //Calcular el total de ingresos acumulados hasta el mes anterior al periodo actual
    const ingresos = cerradas.reduce(
        (total, p) => total.add(p.total_ingresos).sub(p.descuento_faltas).sub(p.descuento_tardanzas).sub(p.descuento_sin_goce).sub(p.descuento_dso),
        new Prisma.Decimal(0)
    );

    return { cerradas, ingresos, retenciones };
}
