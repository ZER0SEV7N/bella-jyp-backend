import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { DiaAdicionalCalendarioDto } from '@jyp/shared-contracts';
import { Injectable } from '@nestjs/common';
import { ActorOperacion, transaccionAsistencia } from '../../services/asistencia-transaccion.helper';

/** Registra un descanso adicional acordado para el calendario. */
@Injectable()
export class GuardarDescansoAsistenciaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    async execute(dto: DiaAdicionalCalendarioDto, actor: ActorOperacion) {
        return transaccionAsistencia(this.prisma, actor, (tx) =>
            tx.asistencia_calendario.upsert({
                where: { fecha: ServerTime.desdeFechaSimple(dto.fecha) },
                create: {
                    id: IdentityGenerator.generateId(),
                    fecha: ServerTime.desdeFechaSimple(dto.fecha),
                    nombre: dto.nombre,
                    motivo: dto.motivo,
                    activo: dto.activo,
                    usuario_id: actor.id
                },
                update: { nombre: dto.nombre, motivo: dto.motivo, activo: dto.activo, usuario_id: actor.id }
            })
        );
    }
}
