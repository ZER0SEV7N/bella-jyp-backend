//src/modules/payroll/planillas/use-case/desembolso/registrarDesembolso.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { bloquearEmpleado, transaccionAuditada } from '@/common/utils/transaccion-auditada.util';
import type { RegistrarDesembolsoDto } from '@jyp/shared-contracts';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Caso de uso para registrar un desembolso de adelanto de sueldo.
 * Este caso de uso valida que la solicitud de adelanto esté aprobada y que no exista un desembolso previo registrado antes de crear un nuevo registro de desembolso.
 * @requires - PrismaService para acceder a la base de datos y realizar las operaciones de registro del desembolso.
 * @requires - ActorOperacion para registrar la auditoría de la operación realizada por el usuario.
 */
@Injectable()
export class RegistrarDesembolsoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para registrar un desembolso de adelanto de sueldo.
   * Valida que la solicitud de adelanto esté aprobada y que no exista un desembolso previo registrado antes de crear un nuevo registro de desembolso.
   * @param dto - Objeto que contiene los datos necesarios para registrar el desembolso, incluyendo la solicitud, fecha, periodo de descuento y referencia.
   * @param actor - Objeto que representa al actor que realiza la operación, incluyendo su identificador y rol.
   * @returns - Promesa que se resuelve con el registro del desembolso si la operación es exitosa.
   * @throws BadRequestException si la fecha del desembolso es futura.
   * @throws ConflictException si la solicitud no está aprobada, no tiene un monto válido o ya tiene un desembolso registrado.
   */
  async execute(dto: RegistrarDesembolsoDto, actor: ActorOperacion) {
    //Valida que la fecha del desembolso no sea futura.
    if (dto.fecha > ServerTime.fechaPeru(new Date())) throw new BadRequestException('El desembolso no puede tener una fecha futura.');

    return transaccionAuditada(this.prisma, actor, async (tx) => {
      //Se obtiene la solicitud de adelanto y se valida que esté aprobada, tenga un monto válido y no tenga un desembolso previo registrado.
      const solicitud = await tx.solicitud.findUnique({ where: { id: dto.solicitud_id, deleted_at: null } });
      if (!solicitud || solicitud.tipo !== 'ADELANTO_SUELDO' || solicitud.estado !== 'APROBADA' || !solicitud.monto?.gt(0))
        throw new ConflictException('Se requiere una solicitud de adelanto aprobada con monto válido.');
      await bloquearEmpleado(tx, solicitud.empleado_id);
      //Una entrega ya registrada es un conflicto de negocio; la restricción única conserva la defensa concurrente.
      const existente = await tx.adelanto_desembolso.findUnique({ where: { solicitud_id: solicitud.id }, select: { id: true } });

      if (existente) throw new ConflictException('El adelanto ya tiene un desembolso registrado.');

      //Se crea un nuevo registro de desembolso utilizando los datos de la solicitud y del DTO proporcionado, incluyendo la fecha, periodo de descuento y referencia.
      return tx.adelanto_desembolso.create({
        data: {
          id: IdentityGenerator.generateId(),
          solicitud_id: solicitud.id,
          empleado_id: solicitud.empleado_id,
          monto: solicitud.monto,
          fecha: ServerTime.desdeFechaSimple(dto.fecha),
          periodo_descuento: dto.periodo_descuento,
          referencia: dto.referencia,
          usuario_id: actor.id,
        },
      });
    });
  }
}
