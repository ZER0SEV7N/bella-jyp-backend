import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Los desembolsos y las novedades resueltas son fuentes distintas del cálculo. */
export async function cargarNovedadesPlanilla(tx: Prisma.TransactionClient, empleadoId: string, periodo: string) {
    const pagos = await tx.adelanto_desembolso.findMany({ where: { empleado_id: empleadoId, periodo_descuento: periodo }, orderBy: { id: 'asc' } });
    const novedades = await tx.novedad_planilla.findMany({ where: { empleado_id: empleadoId, periodo }, orderBy: { id: 'asc' } });
    if (novedades.some((n) => n.estado === 'PENDIENTE'))
        throw new ConflictException('El contador debe resolver las novedades pendientes antes de calcular la planilla.');
    const aprobadas = novedades.filter((n) => n.estado === 'APROBADO');
    const sumarNovedad = (tipo: string) => aprobadas.filter((n) => n.tipo === tipo).reduce((total, n) => total.add(n.monto), new Prisma.Decimal(0));
    if (aprobadas.filter((n) => n.tipo === 'DESCUENTO_DSO').length > 1)
        throw new ConflictException('Debe existir una sola determinación aprobada del descanso semanal por período.');
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
