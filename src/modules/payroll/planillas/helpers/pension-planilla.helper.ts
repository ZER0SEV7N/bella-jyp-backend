//src/modules/payroll/planillas/helpers/pension-planilla.helper.ts
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { cargarFuentesPlanilla } from './fuentes-planilla.helper';

/**
 * Funcion Asincronica para cargar la información de pensión de un empleado en la planilla.
 * Verifica las pensiones y comisiones vigentes según el régimen previsional del empleado.
 * @param tx - Cliente de transacción de Prisma.
 * @param financiero - Información financiera del empleado obtenida de cargarFuentesPlanilla.
 * @param referencia - Fecha de referencia para determinar la vigencia de las comisiones.
 * @returns - Un objeto que contiene el tipo de pensión, si es ONP y las comisiones vigentes.
 */
export async function cargarPensionPlanilla(tx: Prisma.TransactionClient, financiero: Awaited<ReturnType<typeof cargarFuentesPlanilla>>['financiero'], referencia: Date) {
    //Obtener el régimen previsional del empleado y verificar su validez
    const pension = financiero.regimen_pension.nombre.trim().toUpperCase();

    //Verificar si el régimen previsional es ONP o AFP/SPP y cargar las comisiones correspondientes
    const esOnp = pension === 'ONP';
    if (!esOnp && !['AFP', 'SPP', 'SPP / AFP'].includes(pension)) 
        throw new BadRequestException('El régimen previsional no está soportado.');
    
    //Cargar las comisiones vigentes según el régimen previsional y la fecha de referencia
    const comisiones = esOnp ? [] : await tx.comisiones_afp.findMany({
        where: {
            afp_id: financiero.id_tipo_afp,
            periodo_inicio: { lte: referencia },
            OR: [{ periodo_final: null }, { periodo_final: { gte: referencia } }]
        },
        orderBy: { id: 'asc' }
    });

    //Verificar que exista una sola comisión vigente para el régimen AFP/SPP
    if (!esOnp && (!financiero.id_tipo_afp || comisiones.length !== 1))
        throw new ConflictException('Se requiere una sola comisión AFP vigente para el período.');

    //Retornar la información de pensión, si es ONP y las comisiones vigentes
    return { pension, esOnp, comisiones };
}
