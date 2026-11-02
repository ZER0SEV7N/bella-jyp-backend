//src/common/utils/transaccion-auditada.util.ts
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
 * Ejecuta una operación de asistencia dentro de una transacción de Prisma, asegurando la atomicidad y consistencia de los cambios.
 * Se establecen configuraciones de contexto para el actor que realiza la operación y se manejan reintentos en caso de conflictos de concurrencia.
 * @param prisma - La instancia de PrismaService utilizada para acceder a la base de datos.
 * @param actor - El actor que realiza la operación, incluyendo su identificador y dirección IP.
 * @param trabajo - Una función que contiene la lógica de la operación de asistencia a ejecutar dentro de la transacción.
 * @returns - Una promesa que se resuelve con el resultado de la operación si es exitosa.
 * @throws - ConflictException si ocurre un conflicto de concurrencia durante la operación y no se puede completar después de varios intentos.
 */
export async function transaccionAuditada<T>(prisma: PrismaService, actor: ActorOperacion, trabajo: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  //Se realizan hasta 3 intentos de la operación en caso de conflictos de concurrencia (código de error P2034).
  for (let intento = 0; intento < 3; intento++) {
    try {
      //Se ejecuta la operación dentro de una transacción de Prisma con nivel de aislamiento serializable y tiempos de espera configurados.
      return await prisma.$transaction(
        //Se establece el nivel de aislamiento de la transacción como serializable para asegurar que las operaciones se ejecuten de manera aislada y consistente.
        async (tx) => {
          //Se establecen configuraciones de contexto para el actor que realiza la operación, incluyendo su identificador y dirección IP.
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
