import { PrismaService } from '@/common/prisma/prisma.service';
import type { ResolverIncidenciaDto } from '@jyp/shared-contracts';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActorOperacion, bloquearEmpleado, transaccionAsistencia, validarPeriodoEditable } from '../../services/asistencia-transaccion.helper';

/** Rechaza o reabre incidencias con motivo y auditoría. */
@Injectable()
export class ResolverIncidenciaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    async execute(dto: ResolverIncidenciaDto, actor: ActorOperacion) {
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            await bloquearEmpleado(tx, dto.empleado_id);
            await validarPeriodoEditable(tx, dto.empleado_id, dto.periodo, true);
            const actual = await tx.incidencias_mes.findUnique({ where: { empleado_id_periodo: { empleado_id: dto.empleado_id, periodo: dto.periodo } } });
            if (!actual) throw new NotFoundException('La incidencia no existe.');
            if (dto.accion === 'RECHAZAR' && actual.estado !== 'PENDIENTE') throw new ConflictException('Solo se puede rechazar una incidencia pendiente.');
            if (dto.accion === 'REABRIR' && actual.estado === 'PENDIENTE') throw new ConflictException('La incidencia ya está pendiente.');
            return tx.incidencias_mes.update({
                where: { id: actual.id, version: actual.version },
                data: {
                    estado: dto.accion === 'RECHAZAR' ? 'RECHAZADO' : 'PENDIENTE',
                    motivo_revision: dto.motivo,
                    vigente: false,
                    aprobado_por: null,
                    aprobado_en: null,
                    version: { increment: 1 }
                }
            });
        });
    }
}
