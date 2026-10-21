//src/modules/payroll/planillas/helpers/novedades-planilla.helper.ts
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Funcion Asincronica para cargar las novedades de un empleado en la planilla.
 * Verifica que no existan novedades pendientes y que exista una sola determinación de DSO aprobada.
 * @param tx - Cliente de transacción de Prisma.
 * @param empleadoId - ID del empleado para el cual se están cargando las novedades.
 * @param periodo - Periodo en formato 'YYYY-MM' para el cual se están cargando las novedades.
 * @returns - Un objeto que contiene los pagos, novedades aprobadas, adelantos, bono extraordinario, descuentos autorizados y DSO (si existe).
 */
export async function cargarNovedadesPlanilla(tx: Prisma.TransactionClient, empleadoId: string, periodo: string) {
    //Cargar los pagos de adelantos y las novedades de planilla para el empleado y periodo especificados
    const pagos = await tx.adelanto_desembolso.findMany({ where: { empleado_id: empleadoId, periodo_descuento: periodo }, orderBy: { id: 'asc' } });
    const novedades = await tx.novedad_planilla.findMany({ where: { empleado_id: empleadoId, periodo }, orderBy: { id: 'asc' } });
    
    //Verificar que no existan novedades pendientes antes de calcular la planilla
    if (novedades.some((n) => n.estado === 'PENDIENTE'))
        throw new ConflictException('El contador debe resolver las novedades pendientes antes de calcular la planilla.');
   
    //Filtrar las novedades aprobadas y calcular los totales de adelantos, bono extraordinario, descuentos autorizados y DSO
    const aprobadas = novedades.filter((n) => n.estado === 'APROBADO');
    const sumarNovedad = (tipo: string) => aprobadas.filter((n) => n.tipo === tipo).reduce((total, n) => total.add(n.monto), new Prisma.Decimal(0));
    
    //Verificar que exista una sola determinación aprobada del descanso semanal (DSO) por período
    if (aprobadas.filter((n) => n.tipo === 'DESCUENTO_DSO').length > 1)
        throw new ConflictException('Debe existir una sola determinación aprobada del descanso semanal por período.');

    //Calcular el total de adelantos pagados al empleado en el periodo
    const adelantos = pagos.reduce((total, p) => total.add(p.monto), new Prisma.Decimal(0));

    return {
        pagos,
        aprobadas,
        adelantos,
        bono: sumarNovedad('BONO_EXTRAORDINARIO_REMUNERATIVO'),
        autorizado: sumarNovedad('DESCUENTO_AUTORIZADO'),
        dso: aprobadas.some((n) => n.tipo === 'DESCUENTO_DSO') ? sumarNovedad('DESCUENTO_DSO') : null
    };
}
