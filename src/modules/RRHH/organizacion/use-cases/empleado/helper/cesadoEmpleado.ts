import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

export async function anularSolicitudes(prisma: PrismaClientLike, idEmpleado: string): Promise<number> {
  const { inicioMes, inicioSiguienteMes } = ServerTime.obtenerRangoMesActual;
  const tipoSolicitudes = [
    'ACTUALIZACION_DATOS', 'ADELANTO_SUELDO',
    'JUSTIFICACION_ASISTENCIA', 'LICENCIA_MEDICA', 'PERMISO', 'VACACIONES',
  ] as const;

  const { count } = await prisma.solicitud.updateMany({
    where: {
      empleado_id: idEmpleado,
      estado: { in: ['EN_REVISION', 'PENDIENTE'] },
      tipo: { in: [...tipoSolicitudes] },
      created_at: { gte: inicioMes, lt: inicioSiguienteMes },
    },
    data: {
      estado: 'ANULADA',
      motivo: `Cese del empleado realizado en ${ServerTime.fechaPeru(ServerTime.obtenerFechaServidor)}`,
    },
  });

  return count;
}

export async function anularTokens(prisma: PrismaClientLike, idEmpleado: string): Promise<number> {
  const { count } = await prisma.tokens_seguridad.updateMany({
    where: {
      usuarios: { empleado_id: idEmpleado },
      usado: false,
    },
    data: { usado: true },
  });

  return count;
}

// anular contratos vigentes al cesar empleado (sin cambios, solo la firma)
export async function anularContratos(prisma: PrismaClientLike, idEmpleado: string) {
  const fechaHoy = ServerTime.obtenerFechaSimpleActual;
  const textoFecha = ServerTime.fechaPeru(ServerTime.obtenerFechaServidor);
  const observacion = `Contrato finalizado por cese del empleado el ${textoFecha}`;

  const base = {
    empleado_id: idEmpleado,
    deleted_at: null,
  };

  // 1. Sin prórrogas y en curso: se corta hoy
  const sinProrrogas = await prisma.contratos.updateMany({
    where: {
      ...base,
      estado: 'VIGENTE',
      prorrogas: { none: {} },
      fecha_inicio: { lte: fechaHoy },
      OR: [{ fecha_fin: null }, { fecha_fin: { gt: fechaHoy } }],
    },
    data: {
      estado: 'FINALIZADO',
      fecha_fin: fechaHoy,
      observacion,
    },
  });

  // 2. Con prórrogas: solo se finaliza, sin tocar fechas
  const conProrrogas = await prisma.contratos.updateMany({
    where: { ...base, estado: 'VIGENTE', prorrogas: { some: {} } },
    data: { estado: 'FINALIZADO', observacion },
  });

  return sinProrrogas.count + conProrrogas.count;
}

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