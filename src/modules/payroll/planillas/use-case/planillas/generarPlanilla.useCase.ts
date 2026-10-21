//src/modules/payroll/planillas/use-case/generarPlanilla.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { transaccionAsistencia } from '@/modules/asistencia/helpers/asistencia-transaccion.helper';
import { PayrollPoolService } from '@/workers/calculo-masivo/payroll-pool.service';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VERSION_MOTOR_PLANILLA } from '../../domain/calcular-planilla';
import { prepararPlanilla } from '../../helpers/preparar-planilla.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Caso de uso para generar una planilla de un empleado.
 * Este caso de uso valida que la planilla no haya cambiado durante el cálculo y que los resultados sean consistentes antes de guardarla en la base de datos.
 * Se utiliza una transacción para asegurar la atomicidad de la operación y registrar el actor que realiza la acción.
 * @requires - PrismaService para acceder a la base de datos y consultar la planilla.
 * @requires - PayrollPoolService para calcular la planilla utilizando un motor de cálculo externo.
 */
@Injectable()
export class GenerarPlanillaUseCase {
    constructor(private readonly prisma: PrismaService, private readonly piscina: PayrollPoolService) {}

    /**
     * Ejecuta el caso de uso para generar una planilla de un empleado.
     * Valida que la planilla no haya cambiado durante el cálculo y que los resultados sean consistentes antes de guardarla en la base de datos.
     * Se utiliza una transacción para asegurar la atomicidad de la operación y registrar el actor que realiza la acción.
     * @param empleadoId - Identificador del empleado para el cual se generará la planilla.
     * @param periodo - Período para el cual se generará la planilla.
     * @param actor - Objeto que representa al actor que realiza la operación, incluyendo su identificador y rol.
     * @param trabajoId - Identificador opcional del trabajo que solicita la generación de la planilla, utilizado para rastrear la operación en la auditoría.
     * @returns - Promesa que se resuelve con la planilla generada si la operación es exitosa.
     * @throws BadRequestException si ocurre un error de datos durante el cálculo de la planilla.
     * @throws ConflictException si la planilla cambió durante el cálculo o si los resultados no son consistentes con las fuentes.
     */
    async execute(empleadoId: string, periodo: string, actor: ActorOperacion, trabajoId?: string) {
        //Se prepara la planilla para el cálculo, obteniendo la entrada de datos y validando que los cálculos sean consistentes.
        const preparado = await transaccionAsistencia(this.prisma, actor, (tx) => prepararPlanilla(tx, empleadoId, periodo));
        
        //Se calcula la planilla utilizando la entrada preparada y se maneja cualquier error de datos que pueda ocurrir durante el cálculo.
        let resultado: Awaited<ReturnType<PayrollPoolService['calcular']>>;
        try {
            resultado = await this.piscina.calcular(preparado.entrada);
        } catch (error) {
            //Solo una regla del motor es un error de datos; una falla del hilo debe activar el reintento técnico.
            if (error instanceof RangeError) throw new BadRequestException(error.message);
            throw error;
        }
        
        //Se ejecuta la operación dentro de una transacción para asegurar la atomicidad y consistencia de los cambios, 
        //validando que la planilla no haya cambiado durante el cálculo y que los resultados sean consistentes con las fuentes.
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            //Se prepara nuevamente la planilla para el cálculo y se valida que no haya cambiado durante el cálculo.
            const actual = await prepararPlanilla(tx, empleadoId, periodo);
            if (actual.hash !== preparado.hash) 
                throw new ConflictException('Las fuentes cambiaron durante el cálculo. Vuelva a generar la planilla.');

            //Se busca la planilla existente en la base de datos utilizando el identificador del empleado y el período, y se valida que los resultados sean consistentes con las fuentes.
            const existente = await tx.historial_planillas.findUnique({ where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } } });
            if (existente?.fuente_hash === actual.hash && existente.snapshot_calculo) 
                return existente;

            //Se desestructura el resultado del cálculo para separar la versión del motor de cálculo de los montos calculados, 
            //y se prepara un snapshot de la planilla que incluye los resultados, la versión del motor, el actor que realizó la operación y el identificador del trabajo que solicitó la generación de la planilla.
            const { version_motor: _version, ...montos } = resultado;
            const snapshot = { ...actual, resultado, version_motor: VERSION_MOTOR_PLANILLA, generado_por: actor.id, trabajo_id: trabajoId ?? null };
            
            //Se guarda la planilla en la base de datos utilizando un upsert, creando una nueva planilla si no existe o actualizando la existente si ya existe, 
            //asegurando que los resultados sean consistentes con las fuentes y registrando la versión del motor de cálculo y el actor que realizó la operación.
            return tx.historial_planillas.upsert({
                where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
                create: {
                    id: IdentityGenerator.generateId(),
                    empleado_id: empleadoId,
                    periodo,
                    ...montos,
                    estado: 'ABIERTO',
                    incidencia_version: actual.incidencia_version,
                    fuente_hash: actual.hash,
                    snapshot_calculo: snapshot as unknown as Prisma.InputJsonValue
                },
                update: {
                    ...montos,
                    version: { increment: 1 },
                    incidencia_version: actual.incidencia_version,
                    fuente_hash: actual.hash,
                    snapshot_calculo: snapshot as unknown as Prisma.InputJsonValue
                }
            });
        });
    }
}
