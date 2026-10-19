import { PrismaService } from '@/common/prisma/prisma.service';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
export type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/** El bloqueo existe también en los triggers: API, importación y SQL directo siguen el mismo orden. */
export async function bloquearEmpleado(tx: Prisma.TransactionClient, empleadoId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`asistencia:${empleadoId}`}, 0))`;
}

export async function validarPeriodoEditable(tx: Prisma.TransactionClient, empleadoId: string, periodo: string, permitirAprobada = false): Promise<void> {
    const planilla = await tx.historial_planillas.findUnique({
        where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
        select: { estado: true }
    });
    if (planilla && planilla.estado !== 'ABIERTO')
        throw new ConflictException(`La planilla ${periodo} está ${planilla.estado}. No se puede alterar su asistencia.`);
    const incidencia = await tx.incidencias_mes.findUnique({ where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } }, select: { estado: true } });
    if (!permitirAprobada && incidencia?.estado === 'APROBADO')
        throw new ConflictException('Debe reabrir expresamente la incidencia aprobada antes de modificar sus fuentes.');
}

/** El actor se conserva dentro de la misma transacción que los cambios y su auditoría SQL. */
export async function transaccionAsistencia<T>(prisma: PrismaService, actor: ActorOperacion, trabajo: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let intento = 0; intento < 3; intento++) {
        try {
            return await prisma.$transaction(
                async (tx) => {
                    await tx.$executeRaw`SELECT set_config('app.usuario_id', ${actor.id}, true), set_config('app.ip', ${actor.ip}, true)`;
                    return trabajo(tx);
                },
                { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 20000 }
            );
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && intento < 2) continue;
            throw error;
        }
    }
    throw new ConflictException('La información cambió durante la operación. Vuelva a consultarla.');
}
