// src/modules/RRHH/common/sincronizar-jornada-inicial.helper.ts
import { Prisma } from '@prisma/client';
import { HorarioAsistenciaSchema } from '@jyp/shared-contracts';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { validarJornadaRegular } from '@/modules/asistencia/domain/validar-jornada';

/**
 * Parámetros necesarios para sincronizar la jornada inicial de un empleado.
 */
export interface ParametrosJornadaInicial {
  empleadoId: string;
  jornadaId?: string | null;
  fechaInicio: Date;
  usuarioId?: string;
  motivo?: string;
}

/**
 * Crea la fotografía inicial en `asistencia_jornada` al dar de alta a un colaborador con jornada asignada (JOR-F1).
 * Si no hay jornada, falta actor o la jornada no es fija diurna compatible con el motor mensual, retorna `null` sin bloquear el alta.
 */
export async function sincronizarJornadaInicialEmpleado(
  tx: Prisma.TransactionClient,
  params: ParametrosJornadaInicial,
): Promise<boolean> {
  const { empleadoId, jornadaId, fechaInicio, usuarioId } = params;
  if (!jornadaId || !usuarioId) return false;

  // Evitar duplicar si ya existe una asignación en la misma fecha (ej. reintento o upsert en carga masiva)
  const existente = await tx.asistencia_jornada.findUnique({
    where: { empleado_id_desde: { empleado_id: empleadoId, desde: fechaInicio } },
    select: { id: true },
  });
  if (existente) return false;

  // Validar que la jornada exista, esté activa y sea compatible con el motor de asistencia mensual
  const jornada = await tx.jornada.findUnique({
    where: { id: jornadaId, activo: true, deleted_at: null },
  });

  // Si la jornada no existe, es rotativa o nocturna, no se puede crear la fotografía inicial
  if (!jornada || jornada.turno === 'ROTATIVO' || jornada.turno === 'NOCHE') {
    return false;
  }

  // Validar que el horario semanal de la jornada sea consistente con el total de horas semanales
  const horarioValidado = HorarioAsistenciaSchema.safeParse(jornada.horario_semanal);
  if (!horarioValidado.success) return false;

  // Validar que el horario semanal coincida con el total de horas semanales de la jornada
  let minutosSemana: number;
  try {
    minutosSemana = validarJornadaRegular(
      horarioValidado.data,
      jornada.total_horas_semana.toNumber() * 60,
    );
  } catch {
    return false;
  }

  await tx.asistencia_jornada.create({
    data: {
      id: IdentityGenerator.generateId(),
      empleado_id: empleadoId,
      jornada_id: jornada.id,
      desde: fechaInicio,
      horario: horarioValidado.data,
      tolerancia_minutos: jornada.tolerancia_minutos,
      politica_tolerancia: 'COMPLETA',
      minutos_semana: minutosSemana || 2400,
      motivo: params.motivo ?? 'Asignación inicial automática al registrar el legajo del colaborador.',
      usuario_id: usuarioId,
    },
  });

  return true;
}