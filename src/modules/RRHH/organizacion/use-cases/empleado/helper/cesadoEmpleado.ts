//src/modules/RRHH/organizacion/use-cases/empleado/helper/cesadoEmpleado.ts
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

/**
 * Anula las solicitudes pendientes o en revisión de un empleado cesado.
 * @param prisma - Instancia de PrismaService o Prisma.TransactionClient para realizar las operaciones de base de datos.
 * @param idEmpleado - ID del empleado cuyas solicitudes serán anuladas.
 * @returns Una promesa que resuelve con el número de solicitudes anuladas.
 * 
 */
export async function anularSolicitudes(prisma: PrismaClientLike, idEmpleado: string): Promise<number> {
  // Actualiza las solicitudes del empleado que están en estado 'EN_REVISION' o 'PENDIENTE' a 'ANULADA'.
  const { count } = await prisma.solicitud.updateMany({
    where: {
      empleado_id: idEmpleado,
      estado: { in: ['EN_REVISION', 'PENDIENTE'] },
    },

    // Actualiza el estado de las solicitudes a 'ANULADA' y agrega un motivo que indica que el cese del empleado se realizó en la fecha actual.
    data: {
      estado: 'ANULADA',
      motivo: `Cese del empleado realizado en ${ServerTime.fechaPeru(ServerTime.obtenerFechaServidor)}`,
    },
  });

  return count;
}

/**
 * Anula los tokens de seguridad no utilizados de un empleado cesado, marcándolos como usados.
 * 
 * @param prisma - Instancia de PrismaService o Prisma.TransactionClient para realizar las operaciones de base de datos.
 * @param idEmpleado  - ID del empleado cuyos tokens serán anulados.
 * @returns  - Una promesa que resuelve con el número de tokens anulados.
 */
export async function anularTokens(prisma: PrismaClientLike, idEmpleado: string): Promise<number> {
  // Actualiza los tokens de seguridad del empleado que no han sido usados, marcándolos como usados.
  const { count } = await prisma.tokens_seguridad.updateMany({
    where: {
      usuarios: { empleado_id: idEmpleado },
      usado: false,
    },
    data: { usado: true },
  });

  return count;
}

/**
 * Anula los contratos de un empleado cesado, actualizando su estado a 'FINALIZADO' y estableciendo la fecha de finalización.
 * Si el contrato tiene prórrogas, solo se finaliza sin modificar las fechas.
 *  
 * @param prisma - Instancia de PrismaService o Prisma.TransactionClient para realizar las operaciones de base de datos.
 * @param idEmpleado - ID del empleado cuyos contratos serán anulados.
 * @param fechaCese - Fecha de cese del empleado. Si no se proporciona, se utilizará la fecha actual del servidor.
 * @returns - Una promesa que resuelve con el número total de contratos anulados.
 */
export async function anularContratos(
  prisma: PrismaClientLike,
  idEmpleado: string,
  fechaCese: Date = ServerTime.obtenerFechaSimpleActual,
) {
  // Se obtiene la fecha actual del servidor en formato legible para incluirla en la observación de los contratos finalizados.
  const textoFecha = ServerTime.fechaPeru(ServerTime.obtenerFechaServidor);
  const observacion = `Contrato finalizado por cese del empleado el ${textoFecha}`;

  // Base de la consulta para filtrar los contratos del empleado que no han sido eliminados.
  const base = {
    empleado_id: idEmpleado,
    deleted_at: null,
  };

  //Sin prórrogas y en curso: se corta en fechaCese
  const sinProrrogas = await prisma.contratos.updateMany({
    where: {
      ...base,
      estado: 'VIGENTE',
      prorrogas: { none: {} },
      fecha_inicio: { lte: fechaCese },
      OR: [{ fecha_fin: null }, { fecha_fin: { gt: fechaCese } }],
    },
    data: {
      estado: 'FINALIZADO',
      fecha_fin: fechaCese,
      observacion,
    },
  });

  //Con prórrogas: solo se finaliza, sin tocar fechas
  const conProrrogas = await prisma.contratos.updateMany({
    where: { ...base, estado: 'VIGENTE', prorrogas: { some: {} } },
    data: { estado: 'FINALIZADO', observacion },
  });

  return sinProrrogas.count + conProrrogas.count;
}

/**
 * Anula el usuario asociado a un empleado cesado, desactivando su cuenta y estableciendo la fecha de eliminación.
 * 
 * @param prisma - Instancia de PrismaService o Prisma.TransactionClient para realizar las operaciones de base de datos.
 * @param idEmpleado - ID del empleado cuyo usuario será anulado.
 * @returns - Una promesa que resuelve con el número de usuarios anulados (debería ser 1 si el usuario existía y estaba activo, o 0 si no existía o ya estaba inactivo).
 */
export async function anularUsuario(prisma: PrismaClientLike, idEmpleado: string): Promise<number> {
  const { count } = await prisma.usuarios.updateMany({
    where: {
      empleado_id: idEmpleado,
      deleted_at: null,
      activo: true,
    },
    data: {
      activo: false,
      deleted_at: ServerTime.obtenerFechaServidor,
    },
  });

  return count;
}