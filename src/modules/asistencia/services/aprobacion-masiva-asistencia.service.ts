
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { cargarContextoAsistencia, huellaAsistencia } from '../helpers/asistencia-contexto.helper';
import { bloquearEmpleado, transaccionAsistencia, validarPeriodoEditable } from '../helpers/asistencia-transaccion.helper';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';

@Injectable()
export class AprobacionMasivaAsistenciaService {
    constructor(private readonly prisma: PrismaService) {}

    async aprobarLote(periodo: string, empleadoId: string | undefined, actor: ActorOperacion) {
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            const filas = await tx.incidencias_mes.findMany({
                where: { periodo, estado: 'PENDIENTE', ...(empleadoId ? { empleado_id: empleadoId } : {}) },
                orderBy: { empleado_id: 'asc' },
                take: 101
            });
            if (!filas.length) throw new NotFoundException('No se encontraron incidencias pendientes.');
            if (filas.length > 100) throw new BadRequestException('Para más de cien registros, apruebe por colaborador.');
            for (const fila of filas) {
                await bloquearEmpleado(tx, fila.empleado_id);
                await validarPeriodoEditable(tx, fila.empleado_id, periodo);
                if (!fila.vigente || !fila.completo || fila.pendientes > 0)
                    throw new ConflictException(`El colaborador ${fila.empleado_id} tiene un resumen incompleto, desactualizado o con asuntos pendientes.`);
                const contexto = await cargarContextoAsistencia(tx, fila.empleado_id, periodo, ServerTime.obtenerFechaServidor);
                if (huellaAsistencia(contexto) !== fila.fuente_hash) throw new ConflictException('Las fuentes cambiaron. Vuelva a generar el resumen.');
            }
            for (const fila of filas)
                await tx.incidencias_mes.update({
                    where: { id: fila.id, estado: 'PENDIENTE', version: fila.version },
                    data: { estado: 'APROBADO', aprobado_por: actor.id, aprobado_en: new Date(), version: { increment: 1 } }
                });
            return { periodo, registros_aprobados: filas.length };
        });
    }
}
