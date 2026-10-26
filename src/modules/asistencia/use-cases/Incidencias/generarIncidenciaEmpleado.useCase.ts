//src/modules/asistencia/use-cases/Incidencias/generarIncidenciaEmpleado.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calcularAsistencia } from '../../domain/calcular-asistencia';
import { cargarContextoAsistencia, huellaAsistencia } from '../../helpers/asistencia-contexto.helper';
import { bloquearEmpleado, transaccionAuditada } from '@/common/utils/transaccion-auditada.util';
import { validarPeriodoEditable } from '@/modules/asistencia/helpers/periodo-editable.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

/**
 * Caso de uso para generar la incidencia de asistencia de un empleado para un período específico.
 * Este caso de uso calcula la asistencia del empleado y guarda los resultados en la base de datos.
 * Se asegura de que el período sea editable y bloquea al empleado durante la operación para evitar conflictos.
 * Devuelve el registro de incidencia generado o actualizado.
 * @requires - PrismaService para interactuar con la base de datos.
 */
@Injectable()
export class GenerarIncidenciaEmpleadoUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para generar la incidencia de asistencia de un empleado.
     * @param empleadoId - ID del empleado para el cual se generará la incidencia.
     * @param periodo - Período de nómina para el cual se generará la incidencia.
     * @param actor - Información del actor que realiza la operación, incluyendo su ID y dirección IP.
     * @returns - El registro de incidencia generado o actualizado en la base de datos.
     * @throws BadRequestException - Si el período no es editable o si ocurre un error durante la operación.
     * @throws NotFoundException - Si no se encuentra el empleado o el período especificado.
     * @throws InternalServerErrorException - Si ocurre un error inesperado durante la operación.
     */
    async execute(empleadoId: string, periodo: string, actor: ActorOperacion) {
        //Ejecuta la operación dentro de una transacción auditada para garantizar la consistencia de los datos y registrar la auditoría.
        return transaccionAuditada(this.prisma, actor, async (tx) => {
            await bloquearEmpleado(tx, empleadoId); //Bloquea al empleado para evitar conflictos durante la operación
            await validarPeriodoEditable(tx, empleadoId, periodo); //Valida que el período sea editable antes de generar la incidencia
            const contexto = await cargarContextoAsistencia(tx, empleadoId, periodo, ServerTime.obtenerFechaServidor); //Carga el contexto de asistencia del empleado para el período especificado
            const resultado = calcularAsistencia(contexto); //Calcula la asistencia del empleado utilizando el contexto cargado
            const { detalle, version_motor, ...totales } = resultado; //Desestructura el resultado para separar los totales y el detalle de la asistencia

            //Prepara los datos para guardar en la base de datos, incluyendo los totales, el detalle de la asistencia, la huella de asistencia y el estado inicial de la incidencia
            const datos = {
                ...totales,
                detalle: { version_motor, dias: detalle } as unknown as Prisma.InputJsonValue,
                fuente_hash: huellaAsistencia(contexto),
                vigente: true,
                estado: 'PENDIENTE' as const,
                aprobado_por: null,
                aprobado_en: null,
            };

            //Guarda o actualiza el registro de incidencia en la base de datos utilizando un upsert, 
            //asegurando que se mantenga la consistencia de los datos y se incremente la versión del registro si ya existe
            return tx.incidencias_mes.upsert({
                where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
                create: {
                id: IdentityGenerator.generateId(),
                empleado_id: empleadoId,
                ...datos,
                horas_extras_25: new Prisma.Decimal(resultado.minutos_extras_25).div(60),
                horas_extras_35: new Prisma.Decimal(resultado.minutos_extras_35).div(60),
                },
                update: {
                ...datos,
                version: { increment: 1 },
                horas_extras_25: new Prisma.Decimal(resultado.minutos_extras_25).div(60),
                horas_extras_35: new Prisma.Decimal(resultado.minutos_extras_35).div(60),
                },
            });
        });
    }
}
