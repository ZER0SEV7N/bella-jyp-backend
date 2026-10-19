import { ServerTime } from '@/common/utils/server-time';
import { ConflictException } from '@nestjs/common';
import type { historial_planillas } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { corteRetencionesQuinta } from '../domain/calcular-planilla';

/** Suma con decimales de Prisma sin convertir los importes a Number. */
export function sumarHistorial(filas: historial_planillas[], campo: 'descuento_quinta' | 'total_ingresos') {
    return filas.reduce((total, fila) => total.add(fila[campo]), new Prisma.Decimal(0));
}

/** Exige continuidad de históricos congelados y prepara los acumulados para quinta. */
export async function cargarHistorialPlanilla(tx: Prisma.TransactionClient, empleadoId: string, periodo: string, fechaInicio: Date) {
    const { year, month } = ServerTime.validarPeriodo(periodo);
    const anteriores = await tx.historial_planillas.findMany({
        where: { empleado_id: empleadoId, periodo: { gte: `${year}-01`, lt: periodo }, deleted_at: null },
        orderBy: { periodo: 'asc' }
    });
    const primerMes = Math.max(1, fechaInicio.getUTCFullYear() === year ? fechaInicio.getUTCMonth() + 1 : 1);
    for (let mes = primerMes; mes < month; mes++) {
        const texto = `${year}-${String(mes).padStart(2, '0')}`;
        if (!anteriores.some((p) => p.periodo === texto && ['CONGELADO', 'DECLARADO'].includes(p.estado)))
            throw new ConflictException(`Falta el historial congelado de ${texto}. Debe registrar los acumulados previos antes de calcular ${periodo}.`);
    }
    const cerradas = anteriores.filter((p) => ['CONGELADO', 'DECLARADO'].includes(p.estado));

    const corte = corteRetencionesQuinta(month).hastaMes;
    const retenciones = sumarHistorial(
        cerradas.filter((p) => Number(p.periodo.slice(5)) <= corte),
        'descuento_quinta'
    );
    const ingresos = cerradas.reduce(
        (total, p) => total.add(p.total_ingresos).sub(p.descuento_faltas).sub(p.descuento_tardanzas).sub(p.descuento_sin_goce).sub(p.descuento_dso),
        new Prisma.Decimal(0)
    );

    return { cerradas, ingresos, retenciones };
}
