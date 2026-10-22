import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { rol_usuario_enum } from '@prisma/client';
import type { ListarSolicitudesQueryDto } from '@jyp/shared-contracts';
import { PrismaService } from '@/common/prisma/prisma.service';
import { SOLICITUD_INCLUDE } from '../helpers/validacionesSolicitud.helper';

@Injectable()
export class ObtenerSolicitudesUseCase {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: ListarSolicitudesQueryDto, empleadoId: string | null, rol: rol_usuario_enum) {
        if (!['ADMIN', 'RRHH', 'CONTADOR', 'EMPLEADO'].includes(rol))
            throw new ForbiddenException('Su rol no tiene acceso a las solicitudes de RRHH.');

        const page = Number(query.page);
        const limit = Number(query.limit);
        const skip = (page - 1) * limit;
        const where: Prisma.solicitudWhereInput = { deleted_at: null };

        if (query.estado) where.estado = query.estado;
        const tipo = query.tipo;
        if (tipo === 'ADELANTO_VACACIONES' || tipo === 'VENTA_VACACIONES') {
            throw new BadRequestException(`El tipo de solicitud ${tipo} no está disponible en el modelo actual.`);
        }
        if (tipo) where.tipo = tipo;

        if (rol === 'EMPLEADO') {
            if (!empleadoId) throw new BadRequestException('La cuenta no tiene un colaborador asociado.');
            where.empleado_id = empleadoId;
        }

        if (query.fecha_desde || query.fecha_hasta) {
            const createdAt: Prisma.DateTimeFilter = {};
            if (query.fecha_desde) createdAt.gte = this.parseDate(query.fecha_desde, 'fecha_desde');
            if (query.fecha_hasta) {
                const hasta = this.parseDate(query.fecha_hasta, 'fecha_hasta');
                hasta.setUTCDate(hasta.getUTCDate() + 1);
                createdAt.lt = hasta;
            }
            where.created_at = createdAt;
        }

        const search = query.search?.trim();
        if (search) {
            const searchOr: Prisma.solicitudWhereInput[] = [
                { codigo: { contains: search, mode: 'insensitive' } },
                { motivo: { contains: search, mode: 'insensitive' } },
                {
                    empleados: {
                        ...(query.area_id ? { area_id: query.area_id } : {}),
                        OR: [
                            { nro_documento: { contains: search, mode: 'insensitive' } },
                            { nombre: { contains: search, mode: 'insensitive' } },
                            { apellido: { contains: search, mode: 'insensitive' } }
                        ]
                    }
                }
            ];

            where.AND = query.area_id ? [{ empleados: { area_id: query.area_id } }, { OR: searchOr }] : [{ OR: searchOr }];
        } else if (query.area_id) {
            where.empleados = { area_id: query.area_id };
        }

        const [total, solicitudes] = await this.prisma.$transaction([
            this.prisma.solicitud.count({ where }),
            this.prisma.solicitud.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
                include: SOLICITUD_INCLUDE
            })
        ]);

        return {
            data: solicitudes,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    }

    private parseDate(value: string, field: string): Date {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new BadRequestException(`${field} debe tener el formato YYYY-MM-DD.`);
        }

        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
            throw new BadRequestException(`${field} no contiene una fecha válida.`);
        }

        return date;
    }
}