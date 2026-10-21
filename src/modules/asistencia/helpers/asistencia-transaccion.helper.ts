//src/modules/asistencia/helpers/asistencia-transaccion.helper.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Bloquea un empleado para evitar conflictos de concurrencia durante operaciones de asistencia.
 * Utiliza un bloqueo de transacción basado en un hash del empleado para asegurar que solo una operación pueda modificar la asistencia del empleado a la vez.
 * @param tx - La transacción de Prisma en la que se ejecuta el bloqueo.
 * @param empleadoId - El identificador del empleado que se desea bloquear.
 * @returns - Una promesa que se resuelve cuando el empleado ha sido bloqueado exitosamente.
 * @throws - Error si ocurre un problema al intentar bloquear al empleado.
 */
export async function bloquearEmpleado(tx: Prisma.TransactionClient, empleadoId: string): Promise<void> {
    const clave = 'asistencia:' + empleadoId;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clave}, 0))`;
}

/**
 * Valida si el período de asistencia de un empleado es editable.
 * Verifica el estado de la planilla y la incidencia del período especificado para determinar si se pueden realizar cambios en la asistencia.
 * @param tx - La transacción de Prisma en la que se ejecuta la validación.
 * @param empleadoId - El identificador del empleado cuyo período se desea validar.
 * @param periodo - El período de asistencia en formato 'YYYY-MM'.
 * @param permitirAprobada - Indica si se permite modificar un período con incidencia aprobada (por defecto es false).
 * @returns - Una promesa que se resuelve si el período es editable; de lo contrario, lanza una excepción ConflictException.
 * @throws - ConflictException si la planilla está cerrada o si la incidencia está aprobada y no se permite modificarla.
 */
export async function validarPeriodoEditable(tx: Prisma.TransactionClient, empleadoId: string, periodo: string, permitirAprobada = false): Promise<void> {
    //Se busca la planilla del empleado para el período especificado y se obtiene su estado.
    const planilla = await tx.historial_planillas.findUnique({
        where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
        select: { estado: true }
    });

    //Si la planilla existe y su estado no es 'ABIERTO', se lanza una excepción ConflictException indicando que no se puede alterar la asistencia.
    if (planilla && planilla.estado !== 'ABIERTO')
        throw new ConflictException(`La planilla ${periodo} está ${planilla.estado}. No se puede alterar su asistencia.`);
    
    //Se busca la incidencia del empleado para el período especificado y se obtiene su estado.
    const incidencia = await tx.incidencias_mes.findUnique({ where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } }, select: { estado: true } });
    
    //Si la incidencia existe y su estado es 'APROBADO', y no se permite modificarla, se lanza una excepción ConflictException.
    if (!permitirAprobada && incidencia?.estado === 'APROBADO')
        throw new ConflictException('Debe reabrir expresamente la incidencia aprobada antes de modificar sus fuentes.');
}

/**
 * Ejecuta una operación de asistencia dentro de una transacción de Prisma, asegurando la atomicidad y consistencia de los cambios.
 * Se establecen configuraciones de contexto para el actor que realiza la operación y se manejan reintentos en caso de conflictos de concurrencia.
 * @param prisma - La instancia de PrismaService utilizada para acceder a la base de datos.
 * @param actor - El actor que realiza la operación, incluyendo su identificador y dirección IP.
 * @param trabajo - Una función que contiene la lógica de la operación de asistencia a ejecutar dentro de la transacción.
 * @returns - Una promesa que se resuelve con el resultado de la operación si es exitosa.
 * @throws - ConflictException si ocurre un conflicto de concurrencia durante la operación y no se puede completar después de varios intentos.
 */
export async function transaccionAsistencia<T>(prisma: PrismaService, actor: ActorOperacion, trabajo: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    //Se realizan hasta 3 intentos de la operación en caso de conflictos de concurrencia (código de error P2034).
    for (let intento = 0; intento < 3; intento++) {
        try {
            //Se ejecuta la operación dentro de una transacción de Prisma con nivel de aislamiento serializable y tiempos de espera configurados.
            return await prisma.$transaction(

                //Se establece el nivel de aislamiento de la transacción como serializable para asegurar que las operaciones se ejecuten de manera aislada y consistente.
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

    //Si después de 3 intentos la operación no se puede completar debido a conflictos de concurrencia, se lanza una excepción ConflictException.
    throw new ConflictException('La información cambió durante la operación. Vuelva a consultarla.');
}
