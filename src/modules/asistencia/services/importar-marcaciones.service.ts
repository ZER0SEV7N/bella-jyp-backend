import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { Injectable } from '@nestjs/common';
import type { ImportacionPreparada } from '../helpers/preparar-importacion.helper';
import { bloquearEmpleado, transaccionAsistencia, validarPeriodoEditable } from './asistencia-transaccion.helper';

/** Servicio de escritura masiva; la lectura y las acciones HTTP se resuelven fuera del lote. */
@Injectable()
export class ImportarMarcacionesService {
    constructor(private readonly prisma: PrismaService) {}

    async guardar(preparada: ImportacionPreparada, actor: ActorOperacion) {
        const { filas, empleados, porDocumento, vista } = preparada;
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            const ids = empleados.map((e) => e.id).sort();
            for (const id of ids) await bloquearEmpleado(tx, id);
            const rango = ServerTime.obtenerRangoMes(vista.periodo!);
            const existentes = await tx.asistencia_marcacion.findMany({
                where: { empleado_id: { in: ids }, fecha_hora: { gte: rango.inicioMes, lt: rango.inicioSiguienteMes } },
                select: { empleado_id: true, fecha_hora: true, tipo_marcacion: true }
            });
            const claves = new Set(existentes.map((m) => `${m.empleado_id}|${m.fecha_hora.toISOString()}|${m.tipo_marcacion}`));
            const nuevas = filas.flatMap((f) => {
                const empleadoId = porDocumento.get(f.nro_documento)!.id,
                    fecha = ServerTime.desdeHoraPeru(f.fecha, f.hora);
                const clave = `${empleadoId}|${fecha.toISOString()}|${f.tipo_marcacion}`;
                if (claves.has(clave)) return [];
                claves.add(clave);
                return [
                    {
                        id: IdentityGenerator.generateId(),
                        empleado_id: empleadoId,
                        fecha_hora: fecha,
                        tipo_marcacion: f.tipo_marcacion,
                        metodo: 'BIOMETRICO_EXCEL',
                        motivo: `Importación ${vista.archivo_hash}, fila ${f.fila}`,
                        usuario_id: actor.id,
                        importacion_id: vista.archivo_hash
                    }
                ];
            });
            for (const id of new Set(nuevas.map((f) => f.empleado_id))) await validarPeriodoEditable(tx, id, vista.periodo!);
            //La restricción única es la defensa final; la transacción evita importaciones parciales.
            if (nuevas.length) await tx.asistencia_marcacion.createMany({ data: nuevas });
            return { ...vista, insertadas: nuevas.length, duplicadas_omitidas: filas.length - nuevas.length };
        });
    }
}
