//src/modules/asistencia/use-cases/asistencias/asignarJornadaAsistencia.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { AsignarJornadaAsistenciaDto } from '@jyp/shared-contracts';
import { HorarioAsistenciaSchema } from '@jyp/shared-contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {  bloquearEmpleado, transaccionAsistencia } from '../../helpers/asistencia-transaccion.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Caso de uso para asignar una jornada de asistencia a un empleado.
 * Este caso de uso valida que el empleado exista y tenga fecha de ingreso, que la jornada exista y esté activa,
 * y que el horario de la jornada cumpla con las restricciones del motor actual.
 * La operación se realiza dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
 * @requires - PrismaService para acceder a la base de datos y realizar operaciones de lectura y escritura.
 * @requires - ServerTime para obtener la fecha y hora del servidor y validar los períodos.
 * @requires - IdentityGenerator para generar identificadores únicos para las nuevas asignaciones de jornada.
 * @requires - Funciones auxiliares para bloquear empleados y manejar transacciones de asistencia.
 */
@Injectable()
export class AsignarJornadaAsistenciaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para asignar una jornada de asistencia a un empleado.
     * Valida que el empleado exista y tenga fecha de ingreso, que la jornada exista y esté activa,
     * y que el horario de la jornada cumpla con las restricciones del motor actual.
     * La operación se realiza dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
     * @param dto - Dto que contiene el identificador del empleado, el identificador de la jornada, la fecha desde la cual se asigna la jornada,
     * la política de tolerancia y el motivo de la asignación.
     * @param actor - Objeto que representa al actor que realiza la operación, incluyendo su identificador y rol.
     * @returns - Promesa que se resuelve con la asignación de jornada creada si la operación es exitosa.
     * @throws BadRequestException si el empleado no existe o no tiene fecha de ingreso, si la jornada no cumple con las restricciones del motor,
     * o si la política de tolerancia es inválida.
     * @throws NotFoundException si la jornada no existe o está inactiva.
     */
    async execute(dto: AsignarJornadaAsistenciaDto, actor: ActorOperacion) {
        //Se ejecuta la operación dentro de una transacción para asegurar la atomicidad y consistencia de los cambios,
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            //Se bloquea al empleado para evitar conflictos de concurrencia durante la operación.
            await bloquearEmpleado(tx, dto.empleado_id);

            //Se valida que el empleado exista y tenga fecha de ingreso.
            const empleado = await tx.empleados.findUnique({ where: { id: dto.empleado_id, deleted_at: null }, select: { fecha_inicio: true } });
            if (!empleado?.fecha_inicio) 
                throw new BadRequestException('El colaborador debe existir y tener fecha de ingreso.');
            
            //Se valida que la jornada exista, esté activa y cumpla con las restricciones del motor actual.
            const jornada = await tx.jornada.findUnique({ where: { id: dto.jornada_id, activo: true, deleted_at: null } });
            if (!jornada) 
                throw new NotFoundException('La jornada no existe o está inactiva.');

            //Se valida que el horario de la jornada cumpla con las restricciones del motor actual.
            const horario = HorarioAsistenciaSchema.parse(jornada.horario_semanal);
            if (new Set(horario.map((d) => d.dia)).size !== 7) 
                throw new BadRequestException('La jornada debe contener una vez cada día de la semana.');

            //Se valida que la jornada sea fija diurna de 40 horas semanales y que no cruce medianoche.
            if (jornada.turno === 'ROTATIVO' || jornada.turno === 'NOCHE' || !jornada.total_horas_semana.eq(40))
                throw new BadRequestException('El motor actual admite jornadas fijas diurnas de 40 horas semanales.');

            //Se valida que la jornada no cruce medianoche y que tenga cinco días laborables con ocho horas efectivas cada uno.
            for (const dia of horario.filter((d) => d.laborable)){
                if (!dia.entrada || !dia.salida || dia.salida <= dia.entrada)
                    throw new BadRequestException('La jornada no puede cruzar medianoche en este alcance.');
            }

            //Se valida que la política de tolerancia sea válida.
            const minuto = (hora: string) => {
                const [h, m] = hora.split(':').map(Number);
                return h * 60 + m;
            };

            //Se valida que la jornada tenga cinco días laborables con ocho horas efectivas cada uno.
            const laborables = horario.filter((d) => d.laborable);

            //Se valida que la jornada tenga cinco días laborables con ocho horas efectivas cada uno, considerando el tiempo de descanso si está definido.
            if ( laborables.length !== 5 || laborables.some((d) => minuto(d.salida) - minuto(d.entrada) - (d.inicio_descanso && d.fin_descanso ? minuto(d.fin_descanso) - minuto(d.inicio_descanso) : 0) !== 480))
                throw new BadRequestException('La entrega actual admite cinco días con ocho horas efectivas cada uno.');

            //Retorna la asignación de jornada creada en la base de datos, 
            //incluyendo el identificador del empleado, el identificador de la jornada, la fecha desde la cual se asigna la jornada,
            return tx.asistencia_jornada.create({
                data: {
                    id: IdentityGenerator.generateId(),
                    empleado_id: dto.empleado_id,
                    jornada_id: dto.jornada_id,
                    desde: ServerTime.desdeFechaSimple(dto.desde),
                    horario, //Horario de la jornada validado previamente.
                    tolerancia_minutos: jornada.tolerancia_minutos, 
                    politica_tolerancia: dto.politica_tolerancia, //Política de tolerancia proporcionada en el DTO.
                    minutos_semana: 2400, //40 horas semanales * 60 minutos
                    motivo: dto.motivo, //Motivo de la asignación proporcionado en el DTO.
                    usuario_id: actor.id
                }
            });
        });
    }
}
