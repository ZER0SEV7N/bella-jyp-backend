//src/modules/asistencia/use-cases/asistencias/listarMaracaciones.useCase.ts
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import type { ListarMarcacionesQueryDto } from "@jyp/shared-contracts";
import { Prisma } from "@prisma/client";
import dayjs from "dayjs";

/**
 * Caso de uso para listar las marcaciones de asistencia.
 * Este caso de uso permite obtener un listado paginado de las marcaciones de asistencia,
 * aplicando filtros opcionales como empleado, rango de fechas y tipo de marcación.
 * Devuelve un objeto con los datos de las marcaciones y la información de paginación.
 */
@Injectable()
export class ListarMarcacionesUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Metodo de ejecución principal del caso de uso.
     * @param query - Objeto que contiene los parámetros de consulta para filtrar y paginar las marcaciones.
     * @returns Un objeto con los datos de las marcaciones y la información de paginación.
     * @throws InternalServerErrorException - Si ocurre un error inesperado durante la consulta a la base de datos.
     */
    async execute(query: ListarMarcacionesQueryDto) {
        try{
            //Desestructuración de los parámetros de consulta
            const { page, limit, empleado_id, fecha_inicio, fecha_fin, tipo_marcacion } = query;
            const skip = (page - 1) * limit;

            //Construcción de la cláusula WHERE para la consulta a la base de datos
            const whereClause: Prisma.asistencia_marcacionWhereInput = {};

            //Filtros opcionales
            if (empleado_id) whereClause.empleado_id = empleado_id;
            if (tipo_marcacion) whereClause.tipo_marcacion = tipo_marcacion;
            //Filtro por rango de fechas
            if (fecha_inicio || fecha_fin) {
                whereClause.fecha_hora = {};
                if (fecha_inicio) whereClause.fecha_hora.gte = dayjs(fecha_inicio).startOf('day').toDate();
                
                if (fecha_fin) whereClause.fecha_hora.lte = dayjs(fecha_fin).endOf('day').toDate();
            }

            //Ejecución de la consulta a la base de datos para obtener el total y las marcaciones
            const [total, marcaciones] = await Promise.all([
                this.prisma.asistencia_marcacion.count({ where: whereClause }),
                this.prisma.asistencia_marcacion.findMany({
                    where: whereClause,
                    skip,
                    take: limit,
                    orderBy: { fecha_hora: 'desc' },
                    include: {
                        empleados: {
                            select: {
                                id: true,
                                nombre: true,
                                apellido: true,
                                nro_documento: true
                            }
                        }
                    }
                })
            ]);

            //Mapeo de los resultados para devolver solo los campos necesarios
            const data = marcaciones.map(m => ({
                id: m.id,
                empleado_id: m.empleado_id,
                colaborador: `${m.empleados?.nombre ?? ''} ${m.empleados?.apellido ?? ''}`.trim(),
                nro_documento: m.empleados?.nro_documento ?? '',
                fecha_hora: m.fecha_hora,
                tipo_marcacion: m.tipo_marcacion,
                metodo: m.metodo,
            }));

            return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
        } catch (error) {
            throw new InternalServerErrorException('Error al obtener el listado de marcaciones.', error instanceof Error ? error.message : String(error) );
        }
    }
}