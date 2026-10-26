//src/modules/asistencia/use-cases/Incidencias/listarIncidenciasMes.useCase.ts
import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@/common/prisma/prisma.service";
import type { ListarIncidenciasQueryDto } from "@jyp/shared-contracts";
import { Prisma } from "@prisma/client";

/**
 * Caso de uso para listar las incidencias de asistencia mensuales.
 * Este caso de uso permite obtener un listado paginado de las incidencias de asistencia,
 * aplicando filtros opcionales como período, área, estado y búsqueda por DNI o nombres.
 * Devuelve un objeto con los datos de las incidencias y la información de paginación.
 */
@Injectable()
export class ListarIncidenciasMesUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Metodo de ejecución principal del caso de uso.
     * Ejecutar la consulta a la base de datos para obtener las incidencias de asistencia mensuales según los filtros proporcionados.
     * @param query - Objeto que contiene los parámetros de consulta para filtrar y paginar las incidencias.
     * @returns - Un objeto con los datos de las incidencias y la información de paginación.
     * @throws - Lanza una excepción InternalServerErrorException si ocurre un error inesperado durante la consulta a la base de datos.
     */
    async execute(query: ListarIncidenciasQueryDto) {
        try{
            //Desestructuración de los parámetros de consulta
            const { page, limit, periodo, area_id, estado, busqueda } = query;
            const skip = (page - 1) * limit;

            //Clausula WHERE para la consulta a la base de datos, inicializada con el período proporcionado
            const whereClause: Prisma.incidencias_mesWhereInput = { periodo: periodo.trim() };

            //Aplicación de filtros opcionales según los parámetros de consulta
            if (estado) whereClause.estado = estado;
            if (area_id || busqueda) {
                whereClause.empleados = {
                    deleted_at: null,
                    ...(area_id && { area_id }),
                    ...(busqueda && {
                        OR: [
                            { nro_documento: { contains: busqueda.trim(), mode: 'insensitive' } },
                            { nombre: { contains: busqueda.trim(), mode: 'insensitive' } },
                            { apellido: { contains: busqueda.trim(), mode: 'insensitive' } }
                        ]
                    })
                };
            }

            //Ejecución de la consulta a la base de datos para obtener el total y los registros de incidencias
           const [total, registros] = await Promise.all([
                this.prisma.incidencias_mes.count({ where: whereClause }),
                this.prisma.incidencias_mes.findMany({
                    where: whereClause,
                    skip,
                    take: limit,
                    orderBy: { empleado_id: 'asc' },
                    select: {
                        id: true,
                        empleado_id: true,
                        periodo: true,
                        dias_trabajados: true,
                        faltas: true,
                        minutos_tardanza: true,
                        horas_extras_25: true,
                        horas_extras_35: true,
                        estado: true,
                        vigente: true,
                        completo: true,
                        pendientes: true,
                        version: true,
                        empleados: {
                            select: {
                                id: true,
                                nombre: true,
                                apellido: true,
                                nro_documento: true,
                                area: { select: { id: true, nombre: true } },
                                cargo: { select: { id: true, nombre: true } },
                            },
                        },
                    },
                }),
            ]);
            
            //Mapeo de los registros obtenidos para estructurarlos según el DTO de salida esperado
            const data = registros.map((r) => ({
                id: r.id,
                empleado_id: r.empleado_id,
                colaborador: `${r.empleados?.nombre ?? ''} ${r.empleados?.apellido ?? ''}`.trim(),
                nro_documento: r.empleados?.nro_documento ?? '',
                area: r.empleados?.area?.nombre ?? 'Sin Área',
                cargo: r.empleados?.cargo?.nombre ?? 'Sin Cargo',
                periodo: r.periodo,
                dias_trabajados: r.dias_trabajados,
                faltas: r.faltas,
                minutos_tardanza: r.minutos_tardanza,
                horas_extras_25: r.horas_extras_25.toString(),
                horas_extras_35: r.horas_extras_35.toString(),
                estado: r.estado,
                vigente: r.vigente,
                completo: r.completo,
                pendientes: r.pendientes,
                version: r.version,
            }));

            //Devolución de los datos junto con la información de paginación
            return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
        } catch (error) {
            throw new InternalServerErrorException('Error al obtener el listado de incidencias mensuales.', error instanceof Error ? error.message : String(error) );
        }
    }

    /**
     * Metodo para obtener una incidencia de asistencia por su ID.
     * @param id - ID de la incidencia de asistencia a obtener.
     * @returns - El registro de incidencia de asistencia correspondiente al ID proporcionado.
     * @throws - Lanza una excepción NotFoundException si no se encuentra el registro con el ID proporcionado.
     * @throws - Lanza una excepción InternalServerErrorException si ocurre un error inesperado durante la consulta a la base de datos.
     */
    async obtenerPorId(id: string) {
        const elemento = await this.prisma.incidencias_mes.findUnique({
            where: { id },
            include: { empleados: { select: { id: true, nombre: true, apellido: true } } },
        });

        //Si no se encuentra el registro, se lanza una excepción NotFoundException con un mensaje adecuado
        if (!elemento) 
            throw new NotFoundException('Registro no encontrado.');

        //Devolución del registro encontrado
        return elemento;
    }
}