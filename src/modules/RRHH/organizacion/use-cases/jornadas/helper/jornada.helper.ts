//src/modules/RRHH/organizacion/use-cases/jornadas/helper/fechaTiempo.helper.ts
/**
 * Metodos auxiliares para calcular la cantidad de horas trabajadas en un día específico y procesar un horario semanal de trabajo.
 * Estos métodos se utilizan en el módulo de RRHH para validar y calcular las horas de trabajo según la jornada laboral definida.
 * Se consideran los horarios de entrada, salida, periodos de descanso y las restricciones legales y de negocio.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { DiaHorarioDto } from '@jyp/shared-contracts';

/**
 * Calcula la cantidad de horas trabajadas en un día específico, considerando la entrada, salida y los periodos de descanso.
 * @param dia - Objeto que representa el horario de un día, incluyendo si es laborable, la hora de entrada, salida y los periodos de descanso.
 * @returns La cantidad de horas trabajadas en el día, redondeada a dos decimales. Retorna 0 si el día no es laborable o si faltan datos de entrada/salida.
 * @throws {BadRequestException} Si hay un error en la validación de los datos del día.
 */
export function calcularHorasDia(dia: DiaHorarioDto): number {
  if (!dia.laborable || !dia.entrada || !dia.salida) return 0;

  const [hEnt, mEnt] = dia.entrada.split(':').map(Number);
  const [hSal, mSal] = dia.salida.split(':').map(Number);

  let minutosTotales = hSal * 60 + mSal - (hEnt * 60 + mEnt);
  if (minutosTotales <= 0) minutosTotales += 24 * 60; // Cruce de medianoche

  if (dia.inicio_descanso && dia.fin_descanso) {
    const [hDescIni, mDescIni] = dia.inicio_descanso.split(':').map(Number);
    const [hDescFin, mDescFin] = dia.fin_descanso.split(':').map(Number);
    let descansoMinutos = hDescFin * 60 + mDescFin - (hDescIni * 60 + mDescIni);
    if (descansoMinutos <= 0) descansoMinutos += 24 * 60;
    minutosTotales -= descansoMinutos;
  }

  return Math.max(0, Number((minutosTotales / 60).toFixed(2)));
}

/**
 * Procesa y valida un horario semanal de trabajo, calculando el total de horas trabajadas y verificando que cumpla con las restricciones legales y de negocio.
 * @param horarioSemanal - Array de objetos que representan los horarios de cada día de la semana.
 * @param duracion - Duración de la jornada laboral (por ejemplo, 'TIEMPO_PARCIAL' o 'TIEMPO_COMPLETO').
 * @param turno - Tipo de turno de la jornada laboral (por ejemplo, 'ROTATIVO').
 * @param patronRotacion - Patrón de rotación de la jornada laboral, requerido si el turno es 'ROTATIVO'.
 * @throws {BadRequestException} Si el total de horas semanales excede los límites legales o si falta información requerida para el turno rotativo.
 * @returns Un objeto que contiene el total de horas semanales y el horario calculado con las horas totales por día.
 */
export function procesarYValidarHorarioSemanal(horarioSemanal: DiaHorarioDto[], duracion: string, turno: string, patronRotacion?: any) {
  let totalSemanal = 0;
  const horarioCalculado = horarioSemanal.map((dia) => {
    const horas = calcularHorasDia(dia);
    totalSemanal += horas;
    return { ...dia, total_horas: horas };
  });

  totalSemanal = Number(totalSemanal.toFixed(2));

  if (duracion === 'TIEMPO_PARCIAL' && totalSemanal >= 30) throw new BadRequestException({
    title: 'Límite de Tiempo Parcial Excedido',
    detail: `Una jornada a tiempo parcial debe sumar menos de 30 horas semanales (configurado: ${totalSemanal}h).`
  });
  
  if (totalSemanal > 48) throw new BadRequestException({
    title: 'Jornada Excede Límite Legal',
    detail: `El total semanal (${totalSemanal}h) excede el máximo permitido por ley de 48 horas ordinarias.`
  });
  
  if (turno === 'ROTATIVO' && !patronRotacion) throw new BadRequestException({
    title: 'Patrón de Rotación Requerido',
    detail: 'Las jornadas con turno rotativo requieren especificar la configuración del patrón de rotación.'
  });

  return { totalSemanal, horarioCalculado };
}

/** 
 * Verifica que el nombre de la jornada sea único en la base de datos, ignorando un ID específico si se proporciona.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param nombre - Nombre de la jornada a verificar.
 * @param jornadaIdExcluir - ID de la jornada a excluir de la verificación (opcional).
 * @throws BadRequestException si ya existe otra jornada con el mismo nombre.
 * @returns Retorna una promesa que se resuelve si el nombre es único, o lanza una excepción si hay un conflicto.
 */
export async function verificarNombreJornadaUnico(prisma: PrismaService, nombre?: string | null, jornadaIdExcluir?: string): Promise<void> {
  if (!nombre) return;
  const nombreLimpio = nombre.trim();

  const colision = await prisma.jornada.findFirst({
    where: {
      nombre: { equals: nombreLimpio, mode: 'insensitive' },
      ...(jornadaIdExcluir ? { id: { not: jornadaIdExcluir } } : {}),
      deleted_at: null
    },
    select: { id: true }
  });

  if (colision) throw new BadRequestException({
    title: 'Jornada Duplicada',
    detail: `Ya existe una jornada/turno registrada con el nombre '${nombreLimpio}'.`
  });
  
}

/**
 * Verifica que todas las áreas proporcionadas existan y estén activas en la base de datos.
 * @param prisma - Instancia del servicio Prisma para interactuar con la base de datos.
 * @param areasIds - Array de IDs de áreas a verificar.
 * @throws NotFoundException si alguna de las áreas no existe o está inactiva.
 * @returns Retorna una promesa que se resuelve si todas las áreas son válidas, o lanza una excepción si alguna es inválida.
 */
export async function verificarAreasJornada(prisma: PrismaService, areasIds?: string[]): Promise<void> {
  if (!areasIds || areasIds.length === 0) return;

  const totalActivas = await prisma.area.count({
    where: {
      id: { in: areasIds },
      activo: true,
      deleted_at: null
    }
  });

  if (totalActivas !== areasIds.length) throw new NotFoundException({
    title: 'Áreas Inválidas',
    detail: 'Una o más áreas seleccionadas no existen o se encuentran inactivas.'
  });
}