//src/modules/payroll/planillas/use-case/congelarPlanilla.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { transaccionAsistencia } from '@/modules/asistencia/helpers/asistencia-transaccion.helper';
import { PayrollPoolService } from '@/workers/calculo-masivo/payroll-pool.service';
import type { CongelarPlanillaDto } from '@jyp/shared-contracts';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { prepararPlanilla } from '../../helpers/preparar-planilla.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';


/**
 * Caso de uso para congelar una planilla de un empleado.
 * Este caso de uso valida que la planilla exista, que la versión coincida y que los cálculos sean consistentes antes de marcarla como congelada.
 * Se utiliza una transacción para asegurar la atomicidad de la operación y registrar el actor que realiza la acción.
 */
@Injectable()
export class CongelarPlanillaUseCase {
    constructor(private readonly prisma: PrismaService, private readonly piscina: PayrollPoolService) {}

    /**
     * Ejecuta el caso de uso para congelar una planilla.
     * Valida que la planilla exista, que la versión coincida y que los cálculos sean consistentes antes de marcarla como congelada.
     * Se utiliza una transacción para asegurar la atomicidad de la operación y registrar el actor que realiza la acción.
     * @param id - Identificador de la planilla a congelar.
     * @param dto  - Objeto que contiene la versión de la planilla y el motivo de congelamiento.
     * @param actor - Objeto que representa al actor que realiza la operación, incluyendo su identificador y rol.
     * @returns - Promesa que se resuelve con la planilla actualizada si la operación es exitosa.
     * @throws NotFoundException si la planilla no existe.
     * @throws ConflictException si la versión de la planilla no coincide o si los cálculos no son consistentes.
     */
    async execute(id: string, dto: CongelarPlanillaDto, actor: ActorOperacion) {
        //Se ejecuta la operación dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            //Se busca la planilla en la base de datos utilizando el identificador proporcionado.
            const planilla = await tx.historial_planillas.findUnique({ where: { id } });
            
            //Si la planilla no existe, se lanza una excepción NotFoundException.
            if (!planilla) 
                throw new NotFoundException('La planilla no existe.');
            //Si la versión de la planilla no coincide con la proporcionada en el DTO, se lanza una excepción ConflictException.
            if (planilla.version !== dto.version) 
                throw new ConflictException('La planilla cambió desde que fue consultada.');
            
            //Se prepara la planilla para el cálculo, obteniendo la entrada de datos y validando que los cálculos sean consistentes.
            const preparado = await prepararPlanilla(tx, planilla.empleado_id, planilla.periodo);
            
            //Si el hash de la planilla preparada no coincide con el hash de la fuente, o si no hay un snapshot de cálculo, se lanza una excepción ConflictException.
            if (preparado.hash !== planilla.fuente_hash || !planilla.snapshot_calculo)
                throw new ConflictException('La planilla debe regenerarse porque sus fuentes cambiaron.');

            //Se calcula la planilla utilizando la entrada preparada y se compara con los valores almacenados en la base de datos.
            const esperado = await this.piscina.calcular(preparado.entrada);
            for (const [campo, valor] of Object.entries(esperado)) {
                // Se omite la comparación del campo 'version_motor'.
                if (campo === 'version_motor') continue;
                
                //Se obtiene el valor guardado en la base de datos y se compara con el valor calculado. Si no concilian, se lanza una excepción ConflictException.
                const guardado = (planilla as unknown as Record<string, unknown>)[campo];
                if (valor === null ? guardado !== null : guardado === null || guardado === undefined || !new Prisma.Decimal(String(guardado)).eq(String(valor)))
                    throw new ConflictException('Los montos almacenados no concilian con el cálculo. Genere nuevamente la planilla.');
            }
            
            //Se valida que la información de la empresa esté completa antes de permitir congelar la planilla. Si falta algún dato, se lanza una excepción BadRequestException.
            if (!preparado.empresa.nombreEmpresa || !preparado.empresa.direccion || !/^\d{11}$/.test(preparado.empresa.ruc ?? ''))
                throw new BadRequestException('Configure EMPRESA_NOMBRE, EMPRESA_RUC y EMPRESA_DIRECCION antes de validar una planilla.');
            
            //Marca la planilla como congelada, registrando el actor que realizó la validación y el motivo proporcionado.
            return tx.historial_planillas.update({
                where: { id, version: dto.version, estado: 'ABIERTO' },
                data: { estado: 'CONGELADO', validado_por: actor.id, validado_en: new Date(), comentarios: dto.motivo, version: { increment: 1 } }
            });
        });
    }
}
