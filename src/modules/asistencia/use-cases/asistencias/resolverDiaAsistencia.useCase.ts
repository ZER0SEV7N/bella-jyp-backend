import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { ResolverDiaAsistenciaDto } from '@jyp/shared-contracts';
import { ResolverDiaAsistenciaSchema } from '@jyp/shared-contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActorOperacion, bloquearEmpleado, transaccionAsistencia, validarPeriodoEditable } from '../../services/asistencia-transaccion.helper';

/** Registra una decisión de RRHH sin borrar las marcas originales. */
@Injectable()
export class ResolverDiaAsistenciaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    async execute(dto: ResolverDiaAsistenciaDto, actor: ActorOperacion) {
        const validado = ResolverDiaAsistenciaSchema.parse(dto);
        if (dto.fecha > ServerTime.fechaPeru(new Date())) throw new BadRequestException('No se puede resolver una jornada futura.');
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            await bloquearEmpleado(tx, dto.empleado_id);
            await validarPeriodoEditable(tx, dto.empleado_id, dto.fecha.slice(0, 7));
            const empleado = await tx.empleados.findUnique({ where: { id: dto.empleado_id, deleted_at: null }, select: { id: true } });
            if (!empleado) throw new NotFoundException('El colaborador no existe.');
            const { empleado_id, fecha, tipo, motivo, ...datos } = validado;
            const clave = { empleado_id_fecha_tipo: { empleado_id, fecha: ServerTime.desdeFechaSimple(fecha), tipo } };
            return tx.asistencia_decision.upsert({
                where: clave,
                create: {
                    id: IdentityGenerator.generateId(),
                    empleado_id,
                    fecha: ServerTime.desdeFechaSimple(fecha),
                    tipo,
                    motivo,
                    usuario_id: actor.id,
                    datos
                },
                update: { datos, motivo, usuario_id: actor.id, version: { increment: 1 } }
            });
        });
    }
}
