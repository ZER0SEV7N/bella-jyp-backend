//src/modules/asistencia/use-cases/asistencias/resolverDiaAsistencia.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { ResolverDiaAsistenciaDto } from '@jyp/shared-contracts';
import { ResolverDiaAsistenciaSchema } from '@jyp/shared-contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { bloquearEmpleado, transaccionAsistencia, validarPeriodoEditable } from '../../helpers/asistencia-transaccion.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Caso de uso para resolver la asistencia de un empleado en un día específico.
 * Este caso de uso valida los datos de entrada, verifica que el empleado exista y que el período sea editable,
 * y luego realiza la operación de resolver la asistencia dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
 * @requires - PrismaService para acceder a la base de datos y realizar operaciones de lectura y escritura.
 * @param dto - Objeto que contiene los datos necesarios para resolver la asistencia del empleado en un día específico.
 * @param actor - El actor que realiza la operación de resolución de asistencia.
 * @returns - Promesa que se resuelve con el resultado de la operación si es exitosa.
 * @throws - Error de tipo BadRequestException si se intenta resolver una jornada futura o si los datos no son válidos.
 * @throws - Error de tipo NotFoundException si el empleado no existe o si no se puede encontrar el resumen de incidencias para el período especificado.
 */
@Injectable()
export class ResolverDiaAsistenciaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para resolver la asistencia de un empleado en un día específico.
     * Valida los datos de entrada, verifica que el empleado exista y que el período sea editable,
     * y luego realiza la operación de resolver la asistencia dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
     * @param dto - Objeto que contiene los datos necesarios para resolver la asistencia del empleado en un día específico.
     * @param actor - El actor que realiza la operación de resolución de asistencia.
     * @returns - Promesa que se resuelve con el resultado de la operación si es exitosa.
     * @throws - Error de tipo BadRequestException si se intenta resolver una jornada futura o si los datos no son válidos.
     * @throws - Error de tipo NotFoundException si el empleado no existe o si no se puede encontrar el resumen de incidencias para el período especificado.
     */
    async execute(dto: ResolverDiaAsistenciaDto, actor: ActorOperacion) {
        //Se valida el DTO de entrada utilizando el esquema definido en ResolverDiaAsistenciaSchema.
        const validado = ResolverDiaAsistenciaSchema.parse(dto);

        //Se verifica que la fecha proporcionada no sea una jornada futura. Si lo es, se lanza una excepción BadRequestException.
        if (dto.fecha > ServerTime.fechaPeru(new Date())) 
            throw new BadRequestException('No se puede resolver una jornada futura.');

        //Se ejecuta la operación de resolver la asistencia dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            //Se bloquea al empleado para evitar conflictos de concurrencia durante la operación.
            await bloquearEmpleado(tx, dto.empleado_id);
            await validarPeriodoEditable(tx, dto.empleado_id, dto.fecha.slice(0, 7));

            //Se busca el empleado en la base de datos para verificar que exista. Si no se encuentra, se lanza una excepción NotFoundException.
            const empleado = await tx.empleados.findUnique({ where: { id: dto.empleado_id, deleted_at: null }, select: { id: true } });
            if (!empleado) 
                throw new NotFoundException('El colaborador no existe.');

            //Se desestructura el objeto validado para obtener los datos necesarios para la operación de upsert.
            const { empleado_id, fecha, tipo, motivo, ...datos } = validado;
            const clave = { empleado_id_fecha_tipo: { empleado_id, fecha: ServerTime.desdeFechaSimple(fecha), tipo } };
            
            //Se realiza la operación de upsert en la tabla asistencia_decision para resolver la asistencia del empleado en el día específico.
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
