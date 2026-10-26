//src/modules/RRHH/solicitudes/use-cases/obtenerSolicitudes.useCase.ts
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { rol_usuario_enum } from '@prisma/client';
import type { ListarSolicitudesQueryDto } from '@jyp/shared-contracts';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Caso de uso para obtener una lista de solicitudes de RRHH.
 * Este caso de uso tiene como objetivo permitir a los usuarios con los roles adecuados (ADMIN, RRHH, CONTADOR, EMPLEADO)
 * obtener una lista de solicitudes de RRHH filtradas y paginadas según los parámetros proporcionados.
 * Se encarga de validar los permisos del usuario, construir los filtros de búsqueda y devolver la información relevante de las solicitudes.
 */
@Injectable()
export class ObtenerSolicitudesUseCase {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Ejecuta el caso de uso para obtener una lista de solicitudes de RRHH.
     * @param query - Objeto que contiene los parámetros de búsqueda y paginación para filtrar las solicitudes.
     * @param empleadoId - El ID del empleado que está solicitando la lista de solicitudes (puede ser null si el rol es ADMIN o RRHH).
     * @param rol - El rol del usuario que está solicitando la lista de solicitudes (ADMIN, RRHH, CONTADOR o EMPLEADO).
     * @returns - Una promesa que resuelve con un objeto que contiene la lista de solicitudes y la información de paginación.
     * @throws {ForbiddenException} Si el rol del usuario no tiene acceso a las solicitudes de RRHH.
     */
    async execute(query: ListarSolicitudesQueryDto, empleadoId: string | null, rol: rol_usuario_enum) {
        //Validar que el rol del usuario tenga acceso a las solicitudes de RRHH
        if (!['ADMIN', 'RRHH', 'CONTADOR', 'EMPLEADO'].includes(rol))
            throw new ForbiddenException('Su rol no tiene acceso a las solicitudes de RRHH.');

        //Validar y calcular los parámetros de paginación
        const page = Number(query.page);
        const limit = Number(query.limit);
        const skip = (page - 1) * limit;
        const where: Prisma.solicitudWhereInput = { deleted_at: null };

        //Construir los filtros de búsqueda según los parámetros proporcionados
        if (query.estado) 
            where.estado = query.estado;

        //Construir el filtro de tipo de solicitud si se proporciona
        const tipo = query.tipo;
        if (tipo) 
            where.tipo = tipo as Prisma.solicitudWhereInput['tipo'];

        //Si el rol es EMPLEADO, se filtra por el ID del empleado; de lo contrario, se permite acceder a todas las solicitudes.
        if (rol === 'EMPLEADO') {
            //Validar que el empleadoId no sea nulo para los usuarios con rol EMPLEADO
            if (!empleadoId) 
                throw new BadRequestException('La cuenta no tiene un colaborador asociado.');
            
            //Filtrar las solicitudes por el ID del empleado para los usuarios con rol EMPLEADO
            where.empleado_id = empleadoId;
        }

        //Filtrar las solicitudes por el rango de fechas de creación si se proporcionan
        where.created_at = this.filtroFechas(query);

        //Construir el filtro de búsqueda por código, motivo o información del empleado si se proporciona un término de búsqueda
        const search = query.search?.trim();
        //Si se proporciona un término de búsqueda, se construye un filtro OR para buscar coincidencias en el código, motivo o información del empleado.
        if (search) {
            const searchOr: Prisma.solicitudWhereInput[] = [
                { codigo: { contains: search, mode: 'insensitive' } },
                { motivo: { contains: search, mode: 'insensitive' } },
                { empleados: {
                    ...(query.area_id ? { area_id: query.area_id } : {}),
                    OR: [
                        { nro_documento: { contains: search, mode: 'insensitive' } },
                        { nombre: { contains: search, mode: 'insensitive' } },
                        { apellido: { contains: search, mode: 'insensitive' } },
                    ],
                }},
            ];

            //Where se construye con un filtro AND que incluye el filtro de área si se proporciona, y un filtro OR para buscar coincidencias en el código, motivo o información del empleado.
            where.AND = query.area_id ? [{ empleados: { area_id: query.area_id } }, { OR: searchOr }] : [{ OR: searchOr }];
        //Si no se proporciona un filtro de área, se utiliza solo el filtro OR para buscar coincidencias en el código, motivo o información del empleado.
        } else if (query.area_id) 
            where.empleados = { area_id: query.area_id };
        
        //Se realiza una transacción para obtener el total de solicitudes que cumplen con los filtros y la lista de solicitudes paginadas.
        const { estado: _estado, ...filtroConteos } = where;
        //Se realiza una transacción para obtener el total de solicitudes que cumplen con los filtros y la lista de solicitudes paginadas.
        const [total, solicitudes] = await this.prisma.$transaction([
            this.prisma.solicitud.count({ where }),
            this.prisma.solicitud.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
                select: {
                    id: true,
                    codigo: true,
                    empleado_id: true,
                    tipo: true,
                    estado: true,
                    fecha_inicio: true,
                    fecha_fin: true,
                    dias_solicitados: true,
                    monto: true,
                    fecha_limite: true,
                    created_at: true,
                    responsable: { select: { id: true, empleados: { select: { nombre: true, apellido: true } } } },
                    empleados: {
                        select: {
                            id: true,
                            nombre: true,
                            apellido: true,
                            area: { select: { id: true, nombre: true } },
                            cargo: { select: { id: true, nombre: true } },
                        },
                    },
                },
            }),
        ]);

        //Se obtienen los conteos de solicitudes por estado utilizando una transacción para contar las solicitudes en cada estado definido en el arreglo "estados".
        const estados = ['PENDIENTE', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'ANULADA'] as const;
        //Se realiza una transacción para contar las solicitudes en cada estado definido en el arreglo "estados".
        const conteos = await this.prisma.$transaction(estados.map((estado) => this.prisma.solicitud.count({ where: { ...filtroConteos, estado } })) );
        
        //Se construye y devuelve un objeto que contiene la lista de solicitudes con información relevante del colaborador y del responsable, 
        //así como la información de paginación y los conteos por estado.
        return {
            data: solicitudes.map(({ empleados, responsable, ...s }) => ({
                ...s,
                colaborador: {
                    id: empleados.id,
                    nombre_completo: `${empleados.nombre} ${empleados.apellido}`.trim(),
                    area: empleados.area,
                    cargo: empleados.cargo,
                }, responsable: responsable ? { id: responsable.id, nombre_completo: `${responsable.empleados.nombre} ${responsable.empleados.apellido}`.trim() } : null,
            })),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                total_sin_estado: conteos.reduce((a, n) => a + n, 0),
                por_estado: Object.fromEntries(estados.map((e, i) => [e, conteos[i]])),
            },
        };
    }

    /**
     * Metodo privado para construir un filtro de fechas basado en los parámetros de búsqueda proporcionados.
     * @param query - Objeto que contiene los parámetros de búsqueda y paginación para filtrar las solicitudes.
     * @returns - Un objeto Prisma.DateTimeFilter que representa el filtro de fechas construido, o undefined si no se proporcionan fechas.
     */
    private filtroFechas(query: ListarSolicitudesQueryDto): Prisma.DateTimeFilter | undefined {
        //Si se proporcionan fechas de inicio o fin, se construye un filtro de fechas para la consulta.
        if (query.fecha_desde || query.fecha_hasta) {

            //Se construye un filtro de fechas para la consulta, estableciendo los límites de fecha según los parámetros proporcionados.
            const createdAt: Prisma.DateTimeFilter = {};
            
            //Si se proporciona una fecha de inicio, se establece como límite inferior (gte) del filtro de fechas.
            if (query.fecha_desde) createdAt.gte = this.parseDate(query.fecha_desde, 'fecha_desde');
            if (query.fecha_hasta) {
                const hasta = this.parseDate(query.fecha_hasta, 'fecha_hasta');
                hasta.setUTCDate(hasta.getUTCDate() + 1);
                createdAt.lt = hasta;
            }
            return createdAt;
        }

        return undefined;
    }

    /**
     * Metodo privado para analizar y validar una fecha proporcionada en formato YYYY-MM-DD.
     * @param value - La fecha proporcionada como cadena de texto.
     * @param field - El nombre del campo que se está validando (para mensajes de error).
     * @returns - Un objeto Date que representa la fecha analizada y validada.
     * @throws {BadRequestException} Si la fecha no tiene el formato correcto o no es válida.
     */
    private parseDate(value: string, field: string): Date {
        //Validar que la fecha tenga el formato YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) 
            throw new BadRequestException(`${field} debe tener el formato YYYY-MM-DD.`);
        
        //Analizar la fecha y verificar que sea válida
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) 
            throw new BadRequestException(`${field} no contiene una fecha válida.`);
        
        //Devolver la fecha analizada y validada
        return date;
    }
}
