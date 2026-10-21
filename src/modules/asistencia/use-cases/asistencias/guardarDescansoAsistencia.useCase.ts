//src/modules/asistencia/use-cases/asistencias/guardarDescansoAsistencia.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { DiaAdicionalCalendarioDto } from '@jyp/shared-contracts';
import { Injectable } from '@nestjs/common';
import { transaccionAsistencia } from '../../helpers/asistencia-transaccion.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Caso de uso para guardar un día adicional de descanso en el calendario de asistencia.
 * Este caso de uso permite crear o actualizar un registro de descanso en la base de datos,
 * asegurando que la operación se realice dentro de una transacción para mantener la consistencia.
 * @requires - PrismaService para acceder a la base de datos y realizar operaciones de lectura y escritura.
 * @requires - ServerTime para obtener la fecha y hora del servidor y validar los períodos.
 * @requires - IdentityGenerator para generar identificadores únicos para los nuevos registros de descanso.
 * @requires - Funciones auxiliares para manejar transacciones de asistencia.
 */
@Injectable()
export class GuardarDescansoAsistenciaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para guardar un día adicional de descanso en el calendario de asistencia.
     * La operación se realiza dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
     * @param dto - Objeto que contiene la fecha del descanso, el nombre, el motivo y el estado activo del registro.
     * @param actor - Objeto que representa al actor que realiza la operación, incluyendo su identificador y rol.
     * @returns - Promesa que se resuelve con el registro de descanso creado o actualizado si la operación es exitosa.
     * @throws - Error genérico si ocurre un error inesperado durante la operación.
     */
    async execute(dto: DiaAdicionalCalendarioDto, actor: ActorOperacion) {
        //Se ejecuta la operación dentro de una transacción para asegurar la atomicidad y consistencia de los cambios,
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
