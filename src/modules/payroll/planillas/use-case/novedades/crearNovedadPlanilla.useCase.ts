//src/modules/payroll/planillas/use-case/crearNovedadPlanilla.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { ActorOperacion, bloquearEmpleado, transaccionAsistencia } from '@/modules/asistencia/services/asistencia-transaccion.helper';
import type { CrearNovedadPlanillaDto } from '@jyp/shared-contracts';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

/**
 * Caso de uso para crear una novedad de planilla para un empleado.
 * Este caso de uso valida que el empleado exista y que no se exceda el límite de novedades por período antes de crear la novedad.
 * Se utiliza una transacción para asegurar la atomicidad de la operación y registrar el actor que realiza la acción.
 * 
 */
@Injectable()
export class CrearNovedadPlanillaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para crear una novedad de planilla.
     * Valida que el empleado exista y que no se exceda el límite de novedades por período antes de crear la novedad.
     * Se utiliza una transacción para asegurar la atomicidad de la operación y registrar el actor que realiza la acción.
     * @param dto - Objeto que contiene los datos de la novedad de planilla a crear, incluyendo el identificador del empleado, el período y otros detalles relevantes.
     * @param actor - Objeto que representa al actor que realiza la operación, incluyendo su identificador y rol.
     * @returns - Promesa que se resuelve con la novedad de planilla creada si la operación es exitosa.
     * @throws NotFoundException si el empleado no existe.
     * @throws ConflictException si se excede el límite de cien novedades por colaborador en el período especificado.
     */
    async execute(dto: CrearNovedadPlanillaDto, actor: ActorOperacion) {
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            //Se bloquea el empleado para evitar modificaciones concurrentes y se valida que exista en la base de datos.
            await bloquearEmpleado(tx, dto.empleado_id);
            
            //Se valida que el empleado exista y que no se exceda el límite de cien novedades por colaborador en el período especificado.
            if (!(await tx.empleados.findUnique({ where: { id: dto.empleado_id, deleted_at: null }, select: { id: true } })))
                throw new NotFoundException('El colaborador no existe.');

            //Se valida que no se exceda el límite de cien novedades por colaborador en el período especificado.
            if ((await tx.novedad_planilla.count({ where: { empleado_id: dto.empleado_id, periodo: dto.periodo } })) >= 100)
                throw new ConflictException('El período alcanzó el límite de cien novedades por colaborador.');
            return tx.novedad_planilla.create({ data: { id: IdentityGenerator.generateId(), ...dto, registrado_por: actor.id } });
        });
    }
}
