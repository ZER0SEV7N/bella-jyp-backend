//src/modules/payroll/planillas/use-case/novedades/resolverNovedadPlanilla.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { bloquearEmpleado, transaccionAuditada } from '@/common/utils/transaccion-auditada.util';
import type { ResolverNovedadPlanillaDto } from '@jyp/shared-contracts';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Caso de uso para resolver una novedad de planilla.
 * Este caso de uso permite aprobar, rechazar o anular una novedad de planilla, validando que la novedad exista, esté pendiente y que la versión coincida con la proporcionada.
 * @requires - PrismaService para acceder a la base de datos y realizar las operaciones de resolución de la novedad.
 * @requires - ActorOperacion para registrar la auditoría de la operación realizada por el usuario.
 */
@Injectable()
export class ResolverNovedadPlanillaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para resolver una novedad de planilla.
     * Valida que la novedad exista, esté pendiente y que la versión coincida con la proporcionada antes de actualizar su estado y registrar la resolución.
     * @param id - Identificador de la novedad de planilla que se desea resolver.
     * @param dto - Objeto que contiene los datos necesarios para resolver la novedad, incluyendo el nuevo estado, motivo de resolución y versión.
     * @param actor - Objeto que representa al actor que realiza la operación, incluyendo su identificador y rol.
     * @returns - Promesa que se resuelve con el registro actualizado de la novedad de planilla si la operación es exitosa.
     * @throws NotFoundException si la novedad no existe.
     * @throws ConflictException si la novedad ya se resolvió, cambió de versión o no está pendiente.
     */
    async execute(id: string, dto: ResolverNovedadPlanillaDto, actor: ActorOperacion) {
        return transaccionAuditada(this.prisma, actor, async (tx) => {
            //Se obtiene la novedad de planilla por su ID y se valida que exista.
            const n = await tx.novedad_planilla.findUnique({ where: { id } });

            //Si la novedad no existe, lanza una excepción de not found indicando que la novedad no existe.
            if (!n) 
                throw new NotFoundException('La novedad no existe.');
            
            //Se bloquea el empleado asociado a la novedad para evitar modificaciones concurrentes 
            //y se valida que la novedad esté pendiente y que la versión coincida con la proporcionada.
            await bloquearEmpleado(tx, n.empleado_id);
            
            //Si la novedad no está pendiente, o si la versión no coincide con la proporcionada, lanza una excepción de conflicto indicando que la novedad ya se resolvió o cambió de versión.
            if ((n.estado !== 'PENDIENTE' && !(n.estado === 'APROBADO' && dto.estado === 'ANULADO')) || n.version !== dto.version)
                throw new ConflictException('La novedad ya se resolvió o cambió de versión.');

            //Actualiza el estado de la novedad de planilla con el nuevo estado, motivo de resolución, ID del actor que resolvió y aumenta la versión en 1.
            return tx.novedad_planilla.update({
                where: { id, estado: n.estado, version: dto.version },
                data: { estado: dto.estado, motivo_resolucion: dto.motivo, resuelto_por: actor.id, version: { increment: 1 } },
            });
        });
    }
}
