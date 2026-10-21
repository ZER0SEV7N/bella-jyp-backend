import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calcularAsistencia } from '../../domain/calcular-asistencia';
import { cargarContextoAsistencia, huellaAsistencia } from '../../helpers/asistencia-contexto.helper';
import {  bloquearEmpleado, transaccionAsistencia, validarPeriodoEditable } from '../../helpers/asistencia-transaccion.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';


/** Calcula y guarda el resumen mensual de un colaborador. */
@Injectable()
export class GenerarIncidenciaEmpleadoUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /** Cada empleado se confirma de forma atómica; un resumen parcial nunca queda aprobado. */
    async execute(empleadoId: string, periodo: string, actor: ActorOperacion) {
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            await bloquearEmpleado(tx, empleadoId);
            await validarPeriodoEditable(tx, empleadoId, periodo);
            const contexto = await cargarContextoAsistencia(tx, empleadoId, periodo, ServerTime.obtenerFechaServidor);
            const resultado = calcularAsistencia(contexto);
            const { detalle, version_motor, ...totales } = resultado;
            const datos = {
                ...totales,
                detalle: { version_motor, dias: detalle } as unknown as Prisma.InputJsonValue,
                fuente_hash: huellaAsistencia(contexto),
                vigente: true,
                estado: 'PENDIENTE' as const,
                aprobado_por: null,
                aprobado_en: null
            };
            return tx.incidencias_mes.upsert({
                where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } },
                create: {
                    id: IdentityGenerator.generateId(),
                    empleado_id: empleadoId,
                    ...datos,
                    horas_extras_25: new Prisma.Decimal(resultado.minutos_extras_25).div(60),
                    horas_extras_35: new Prisma.Decimal(resultado.minutos_extras_35).div(60)
                },
                update: {
                    ...datos,
                    version: { increment: 1 },
                    horas_extras_25: new Prisma.Decimal(resultado.minutos_extras_25).div(60),
                    horas_extras_35: new Prisma.Decimal(resultado.minutos_extras_35).div(60)
                }
            });
        });
    }
}
