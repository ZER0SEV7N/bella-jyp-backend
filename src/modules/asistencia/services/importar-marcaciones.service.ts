//src/modules/asistencia/services/importar-marcaciones.service.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ActorOperacion } from '@/common/utils/actor-operacion.util';
import { ServerTime } from '@/common/utils/server-time';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { Injectable } from '@nestjs/common';
import type { ImportacionPreparada } from '../helpers/preparar-importacion.helper';
import { bloquearEmpleado, transaccionAsistencia, validarPeriodoEditable } from '../helpers/asistencia-transaccion.helper';

/**
 * Servicio para importar marcaciones de asistencia desde un archivo Excel.
 * Este servicio procesa los datos preparados de la importación, bloquea a los empleados involucrados,
 * valida que los períodos sean editables y guarda las nuevas marcaciones en la base de datos.
 * La operación se realiza dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
 * @requires - PrismaService para acceder a la base de datos y realizar operaciones de lectura y escritura.
 * @requires - ServerTime para obtener la fecha y hora del servidor y validar los períodos.
 * @requires - IdentityGenerator para generar identificadores únicos para las nuevas marcaciones.
 * @requires - Funciones auxiliares para bloquear empleados, validar períodos editables y manejar transacciones de asistencia.
 */
@Injectable()
export class ImportarMarcacionesService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Metodo principal para importar marcaciones de asistencia.
     * Este metodo procesa los datos preparados de la importación, bloquea a los empleados involucrados,
     * valida que los períodos sean editables y guarda las nuevas marcaciones en la base de datos.
     * La operación se realiza dentro de una transacción para asegurar la atomicidad y consistencia de los cambios.
     * @param preparada - Objeto que contiene los datos preparados de la importación, incluyendo las filas de marcaciones, los empleados involucrados,
     * un mapa de empleados por documento y la vista de la importación.
     * @param actor - Objeto que representa al actor que realiza la operación, incluyendo su identificador y rol.
     * @returns - Promesa que se resuelve con un objeto que contiene la vista de la importación y el número de marcaciones insertadas y duplicadas omitidas.
     * @throws - BadRequestException si ocurre un error de validación durante la importación.
     * @throws - ConflictException si la información cambió durante la operación y no se puede completar la importación.
     * @throws - NotFoundException si no se encuentran empleados para los documentos proporcionados en la importación.
     * @throws - Error genérico si ocurre un error inesperado durante la operación.
     */
    async guardar(preparada: ImportacionPreparada, actor: ActorOperacion) {
        //Desestructura los datos preparados de la importación para su procesamiento.
        const { filas, empleados, porDocumento, vista } = preparada; 

        //Se ejecuta la operación dentro de una transacción para asegurar la atomicidad y consistencia de los cambios,
        return transaccionAsistencia(this.prisma, actor, async (tx) => {
            //Se bloquea a cada empleado involucrado en la importación para evitar conflictos de concurrencia durante la operación.
            const ids = empleados.map((e) => e.id).sort();
            //Se valida que los períodos de los empleados sean editables antes de insertar las nuevas marcaciones.
            for (const id of ids) 
                await bloquearEmpleado(tx, id);

            const rango = ServerTime.obtenerRangoMes(vista.periodo); //Obtenemos el rango de fechas del mes para el período de la importación.

            //Se buscan las marcaciones existentes en la base de datos para los empleados involucrados y el rango de fechas del período de la importación.
            const existentes = await tx.asistencia_marcacion.findMany({
                where: { empleado_id: { in: ids }, fecha_hora: { gte: rango.inicioMes, lt: rango.inicioSiguienteMes } },
                select: { empleado_id: true, fecha_hora: true, tipo_marcacion: true }
            });

            //Se crea un conjunto de claves únicas para las marcaciones existentes, utilizando el identificador del empleado, la fecha y hora de la marcación y el tipo de marcación.
            const claves = new Set(existentes.map((m) => `${m.empleado_id}|${m.fecha_hora.toISOString()}|${m.tipo_marcacion}`));

            //Se procesan las nuevas marcaciones de la importación, omitiendo las duplicadas que ya existen en la base de datos.
            const nuevas = filas.flatMap((f) => {
                //Se obtiene el identificador del empleado correspondiente al documento de la fila de marcación y se calcula la fecha y hora de la marcación.
                const empleadoId = porDocumento.get(f.nro_documento)!.id, fecha = ServerTime.desdeHoraPeru(f.fecha, f.hora);
                //Se crea una clave única para la marcación y se verifica si ya existe en el conjunto de claves. Si existe, se omite; si no, se agrega al conjunto y se prepara para su inserción en la base de datos.
                const clave = `${empleadoId}|${fecha.toISOString()}|${f.tipo_marcacion}`;
                
                //Si la clave ya existe en el conjunto de claves, significa que la marcación es duplicada y se omite; si no, se agrega al conjunto y se prepara para su inserción en la base de datos.
                if (claves.has(clave)) 
                    return [];

                //Si la clave no existe, se agrega al conjunto de claves y se prepara un objeto de marcación para su inserción en la base de datos.
                claves.add(clave);

                //Se retorna un objeto de marcación que contiene el identificador del empleado, la fecha y hora de la marcación, el tipo de marcación, el método de importación, el motivo de la importación, el identificador del usuario que realiza la operación y el identificador de la importación.
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
            
            //Se validan los períodos editables de los empleados involucrados en la importación.
            for (const id of new Set(nuevas.map((f) => f.empleado_id))) 
                await validarPeriodoEditable(tx, id, vista.periodo);
            //La restricción única es la defensa final; la transacción evita importaciones parciales.
            if (nuevas.length) 
                await tx.asistencia_marcacion.createMany({ data: nuevas });
            return { ...vista, insertadas: nuevas.length, duplicadas_omitidas: filas.length - nuevas.length };
        });
    }
}
