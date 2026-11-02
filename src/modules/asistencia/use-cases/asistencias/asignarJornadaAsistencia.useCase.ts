//src/modules/asistencia/use-cases/asistencias/asignarJornadaAsistencia.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import type { AsignarJornadaAsistenciaDto } from '@jyp/shared-contracts';
import { HorarioAsistenciaSchema } from '@jyp/shared-contracts';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { bloquearEmpleado, transaccionAuditada } from '@/common/utils/transaccion-auditada.util';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
import { validarJornadaRegular } from '../../domain/validar-jornada';

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
    return transaccionAuditada(this.prisma, actor, async (tx) => {
      //Se bloquea al empleado para evitar conflictos de concurrencia durante la operación.
      await bloquearEmpleado(tx, dto.empleado_id);

      //Se valida que el empleado exista y tenga fecha de ingreso.
      const empleado = await tx.empleados.findUnique({ where: { id: dto.empleado_id, deleted_at: null }, select: { fecha_inicio: true } });
      if (!empleado?.fecha_inicio) throw new BadRequestException('El colaborador debe existir y tener fecha de ingreso.');

      //Se valida que la jornada exista, esté activa y cumpla con las restricciones del motor actual.
      const jornada = await tx.jornada.findUnique({ where: { id: dto.jornada_id, activo: true, deleted_at: null } });
      if (!jornada) throw new NotFoundException('La jornada no existe o está inactiva.');

      //Se valida que el horario de la jornada cumpla con las restricciones del motor actual.
      const validado = HorarioAsistenciaSchema.safeParse(jornada.horario_semanal);
      if (!validado.success) 
        throw new BadRequestException('El horario de la jornada no es válido.');
      
      //Se valida el horario de la jornada y 
      //se calcula los minutos semanales, asegurando que la jornada no comience antes del ingreso del empleado.
      const horario = validado.data;
      if (jornada.turno === 'ROTATIVO' || jornada.turno === 'NOCHE')
        throw new BadRequestException('El motor mensual admite jornadas fijas diurnas.');
      
      //Se valida que la jornada cumpla con las restricciones del motor actual, 
      //incluyendo el cálculo de los minutos semanales y la verificación de que la jornada no comience antes del ingreso del empleado.
      let minutosSemana: number;
      try {
        minutosSemana = validarJornadaRegular(horario, jornada.total_horas_semana.toNumber() * 60);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : 'Jornada inválida.');
      }

      //Se valida que la fecha desde la cual se asigna la jornada no sea anterior a la fecha de ingreso del empleado y que no exista una jornada asignada desde esa fecha.
      const desde = ServerTime.desdeFechaSimple(dto.desde);
      if (desde < empleado.fecha_inicio) 
        throw new BadRequestException('La jornada no puede comenzar antes del ingreso.');
      
      //Se verifica si ya existe una jornada asignada desde la fecha especificada para el empleado. Si existe, se lanza una excepción ConflictException indicando que ya existe una jornada asignada desde esa fecha.
      const existente = await tx.asistencia_jornada.findUnique({
        where: { empleado_id_desde: { empleado_id: dto.empleado_id, desde } },
        select: { id: true },
      });

      if (existente) 
        throw new ConflictException('Ya existe una jornada asignada desde esa fecha.');

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
          minutos_semana: minutosSemana || 2400, //Minutos semanales calculados a partir del horario de la jornada.
          motivo: dto.motivo, //Motivo de la asignación proporcionado en el DTO.
          usuario_id: actor.id,
        },
      });
    });
  }
}
