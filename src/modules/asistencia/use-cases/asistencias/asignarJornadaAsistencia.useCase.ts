import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { AsignarJornadaAsistenciaDto } from '@jyp/shared-contracts';
import { HorarioAsistenciaSchema } from '@jyp/shared-contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActorOperacion, bloquearEmpleado, transaccionAsistencia } from '../../services/asistencia-transaccion.helper';

/** Conserva una asignación de jornada y su vigencia histórica. */
@Injectable()
export class AsignarJornadaAsistenciaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    async execute(dto: AsignarJornadaAsistenciaDto, actor: ActorOperacion) {
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            await bloquearEmpleado(tx, dto.empleado_id);
            const empleado = await tx.empleados.findUnique({ where: { id: dto.empleado_id, deleted_at: null }, select: { fecha_inicio: true } });
            if (!empleado?.fecha_inicio) throw new BadRequestException('El colaborador debe existir y tener fecha de ingreso.');
            const jornada = await tx.jornada.findUnique({ where: { id: dto.jornada_id, activo: true, deleted_at: null } });
            if (!jornada) throw new NotFoundException('La jornada no existe o está inactiva.');
            const horario = HorarioAsistenciaSchema.parse(jornada.horario_semanal);
            if (new Set(horario.map((d) => d.dia)).size !== 7) throw new BadRequestException('La jornada debe contener una vez cada día de la semana.');
            if (jornada.turno === 'ROTATIVO' || jornada.turno === 'NOCHE' || !jornada.total_horas_semana.eq(40))
                throw new BadRequestException('El motor actual admite jornadas fijas diurnas de 40 horas semanales.');
            for (const dia of horario.filter((d) => d.laborable))
                if (!dia.entrada || !dia.salida || dia.salida <= dia.entrada)
                    throw new BadRequestException('La jornada no puede cruzar medianoche en este alcance.');
            const minuto = (hora: string) => {
                const [h, m] = hora.split(':').map(Number);
                return h * 60 + m;
            };
            const laborables = horario.filter((d) => d.laborable);
            if (
                laborables.length !== 5 ||
                laborables.some(
                    (d) =>
                        minuto(d.salida!) -
                            minuto(d.entrada!) -
                            (d.inicio_descanso && d.fin_descanso ? minuto(d.fin_descanso) - minuto(d.inicio_descanso) : 0) !==
                        480
                )
            )
                throw new BadRequestException('La entrega actual admite cinco días con ocho horas efectivas cada uno.');
            return tx.asistencia_jornada.create({
                data: {
                    id: IdentityGenerator.generateId(),
                    empleado_id: dto.empleado_id,
                    jornada_id: dto.jornada_id,
                    desde: ServerTime.desdeFechaSimple(dto.desde),
                    horario,
                    tolerancia_minutos: jornada.tolerancia_minutos,
                    politica_tolerancia: dto.politica_tolerancia,
                    minutos_semana: 2400,
                    motivo: dto.motivo,
                    usuario_id: actor.id
                }
            });
        });
    }
}
