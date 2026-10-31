//src/modules/integraciones/services/datos-exportacion.service.ts
import { ConflictException, Injectable, NotFoundException} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { FilaExportacionSchema } from '@jyp/shared-contracts';
import type { ResultadoDia } from '@/modules/asistencia/domain/asistencia.types';

/**
 * Servicio para manejar la exportación de datos de planillas.
 * Este servicio proporciona métodos para paginar y recuperar filas de datos de planillas asociadas a un trabajo de integración.
 * Se encarga de validar la existencia del trabajo, su estado y la integridad de los datos antes de devolverlos.
 * También se asegura de que los datos exportados sean consistentes con el estado de la planilla y el detalle de jornada.
 */
@Injectable()
export class DatosExportacionService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Obtiene una página de filas de datos de planillas asociadas a un trabajo de integración.
     * Valida que el trabajo exista, esté en estado 'PROCESANDO' y que la ejecución sea válida.
     * También valida que la página solicitada sea un número entero seguro y no negativo.
     * @param trabajoId - El ID del trabajo de integración.
     * @param pagina - El número de página a recuperar (0-indexado).
     * @param ejecucionId - El ID de ejecución que se asignó al trabajo reclamado.
     * @returns - Un objeto que contiene las filas de datos de la página solicitada y el número de la siguiente página si existe.
     * @throws ConflictException - Si el trabajo no está en estado 'PROCESANDO', la ejecución no coincide o la página es inválida.
     * @throws NotFoundException - Si el trabajo o las planillas asociadas no existen.
     */
    async pagina(trabajoId: string, pagina: number, ejecucionId: string) {
        // Se consulta el trabajo de integración en la base de datos por su ID.
        const trabajo = await this.prisma.integracionTrabajo.findUnique({ where: { id: trabajoId } });
        
        // Se valida que el trabajo exista, esté en estado 'PROCESANDO' y que la ejecución coincida con la proporcionada.
        if (!trabajo || trabajo.estado !== 'PROCESANDO' || trabajo.ejecucion_id !== ejecucionId)
            throw new ConflictException('El ejecutor no tiene una concesión activa para este trabajo.');

        // Se valida que la página solicitada sea un número entero seguro y no negativo.
        if (!Number.isSafeInteger(pagina) || pagina < 0)
            throw new ConflictException('Página inválida.');

        // Se obtiene un subconjunto de IDs de planillas correspondientes a la página solicitada (25 planillas por página).
        const ids = trabajo.planilla_ids.slice(pagina * 25, (pagina + 1) * 25);
        const filas = [];

        // Se itera sobre los IDs de planillas y se obtiene la fila de datos correspondiente a cada planilla.
        for (const id of ids)
            filas.push(await this.fila(id, trabajo.creado_en));
        
        // Se retorna un objeto que contiene las filas de datos de la página solicitada y el número de la siguiente página si existe.
        return {
            filas,
            siguiente:
                (pagina + 1) * 25 < trabajo.planilla_ids.length
                    ? pagina + 1
                    : null,
        };
    }

    /**
     * Funcion asincrónica privada para obtener la fila de datos de una planilla específica.
     * Valida que la planilla exista, esté en un estado cerrado y que el detalle de jornada coincida con la versión cerrada.
     * También valida que el legajo y la cuenta del empleado no hayan cambiado después de solicitar el archivo.
     * @param id - El ID de la planilla a consultar.
     * @param solicitadoEn - La fecha y hora en que se solicitó la exportación, utilizada para validar cambios posteriores en el legajo o cuenta del empleado.
     * @returns - Un objeto que contiene los datos de la planilla y del empleado, incluyendo información de la empresa, cabecera, resultado, nombres, apellidos, tipo de documento, email, fechas de inicio y cese, banco, cuenta, CCI, CUSPP, régimen y minutos trabajados.
     * @throws NotFoundException - Si la planilla no existe o no está en un estado cerrado.
     * @throws ConflictException - Si el detalle de jornada no coincide con la versión cerrada, falta el detalle diario de jornada, el documento del empleado difiere del conservado en la planilla o el legajo/cuenta cambió después de solicitar el archivo.
     */
    private async fila(id: string, solicitadoEn: Date) {
        // Se consulta la planilla en la base de datos, incluyendo los datos del empleado y su información financiera.
        const planilla = await this.prisma.historial_planillas.findUnique({
            where: { id },
            include: {
                empleados: {
                    include: {
                        tipo_documento: true,
                        dato_financiero: { include: { banco_sueldo: true } },
                    },
                },
            },
        });

        // Se valida que la planilla exista y esté en un estado cerrado ('CONGELADO' o 'DECLARADO').
        if (!planilla || !['CONGELADO', 'DECLARADO'].includes(planilla.estado))
            throw new NotFoundException('La exportación requiere una planilla cerrada.');

        // Se obtiene el snapshot de cálculo de la planilla y se valida que contenga la información necesaria para la exportación.
        const snapshot = planilla.snapshot_calculo as unknown as Record<string, unknown>;

        // Se valida que el snapshot contenga la cabecera, empresa, resultado y entrada necesarios para la exportación.
        if (!snapshot?.cabecera || !snapshot.empresa || !snapshot.resultado || !snapshot.entrada)
            throw new ConflictException('La planilla no conserva un snapshot exportable.');

        // Se consulta la incidencia mensual asociada al empleado y periodo de la planilla para validar la integridad del detalle de jornada.
        const incidencia = await this.prisma.incidencias_mes.findUnique({
            where: {
                empleado_id_periodo: {
                    empleado_id: planilla.empleado_id,
                    periodo: planilla.periodo,
                },
            },
        });

        // Se valida que la incidencia exista y que su versión coincida con la versión de incidencia de la planilla.
        if (!incidencia || incidencia.version !== planilla.incidencia_version)
            throw new ConflictException('El detalle de jornada no coincide con la versión cerrada.');

        // Se obtiene el detalle de la incidencia y se valida que contenga un arreglo de días con la información diaria de jornada.
        const detalle = incidencia.detalle as unknown as {
            dias?: ResultadoDia[];
        };

        // Se valida que el detalle contenga un arreglo de días, ya que es necesario para calcular los minutos trabajados y otros datos de la planilla.
        if (!Array.isArray(detalle?.dias))
            throw new ConflictException('Falta el detalle diario de jornada.');

        // Se obtiene el empleado y su información financiera asociada a la planilla, así como la cabecera del snapshot para validar la integridad de los datos.
        const empleado = planilla.empleados;
        const financiero = empleado.dato_financiero;
        const cabecera = snapshot.cabecera as { nro_documento: string };

        // Se valida que el documento del empleado coincida con el documento conservado en la planilla, para garantizar la integridad de los datos.
        if (empleado.nro_documento !== cabecera.nro_documento)
            throw new ConflictException('El documento actual difiere de la identidad conservada en la planilla. Revise el historial antes de exportar.');
        // No se cambian destinatarios ni cuentas silenciosamente mientras n8n espera en cola.
        if ( empleado.updated_at > solicitadoEn || (financiero && financiero.updated_at > solicitadoEn))
            throw new ConflictException('El legajo o cuenta cambió después de solicitar el archivo. Revise y cree una nueva exportación.');

        // Se obtiene la entrada del snapshot y se valida que contenga el régimen del empleado, necesario para la exportación.
        const entrada = snapshot.entrada as { regimen: 'ONP' | 'AFP' };

        // Se retorna un objeto que contiene los datos de la planilla y del empleado, incluyendo información de la empresa, cabecera, resultado, nombres, apellidos, tipo de documento, email, fechas de inicio y cese, banco, cuenta, CCI, CUSPP, régimen y minutos trabajados.
        return FilaExportacionSchema.parse({
            planilla_id: planilla.id,
            empleado_id: empleado.id,
            periodo: planilla.periodo,
            empresa: snapshot.empresa,
            cabecera: snapshot.cabecera,
            resultado: snapshot.resultado,
            nombres: empleado.nombre,
            apellidos: empleado.apellido,
            tipo_documento: empleado.tipo_documento.tipo_documento,
            email: empleado.email,
            fecha_inicio: empleado.fecha_inicio.toISOString().slice(0, 10),
            fecha_cese: empleado.fecha_cese?.toISOString().slice(0, 10) ?? null,
            banco: financiero?.banco_sueldo?.nombre ?? null,
            cuenta: CryptoUtil.decrypt(financiero?.nro_cuenta_sueldo),
            cci: CryptoUtil.decrypt(financiero?.cci_sueldo),
            cuspp: financiero?.cuspp ?? null,
            regimen: entrada.regimen,
            minutos_ordinarios: detalle.dias.reduce(
                (suma, dia) => suma + Math.max( 0, dia.minutos_trabajados - dia.minutos_extra_observados ), 0 
            ), // Se calcula la suma de minutos ordinarios trabajados, excluyendo los minutos extra observados.
            minutos_sobretiempo: incidencia.minutos_extras_25 + incidencia.minutos_extras_35,
        });
    }
}
