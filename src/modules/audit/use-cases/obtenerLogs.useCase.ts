//src/modules/audit/use-cases/ObtenerLogs.useCase.ts
//Caso de uso para obtener logs de auditoría con filtros y paginación
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ObtenerAuditQueryDto } from '@jyp/shared-contracts';

@Injectable()
export class ObtenerLogsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ObtenerAuditQueryDto,
    userRequesting: { id: string; rol: string },
  ) {
    const { page, limit, tabla_afectada, accion, usuario_id, registro_id } =
      query; //Parametros de consulta para filtrar los logs de auditoría
    const skip = (page - 1) * limit; //Calcular el número de registros a omitir para la paginación

    const where: any = {}; //Objeto para almacenar los filtros de consulta

    if (tabla_afectada) where.tabla_afectada = tabla_afectada; //Agregar filtro por tabla afectada si se proporciona
    if (accion) where.accion = accion; //Agregar filtro por acción si se proporciona
    if (usuario_id) where.usuario_id = usuario_id; //Agregar filtro por ID de usuario si se proporciona
    if (registro_id) where.registro_id = registro_id; //Agregar filtro por ID de registro si se proporciona

    //REGLA DE NEGOCIO: Privacidad de Auditoría
    if (userRequesting.rol === 'ADMIN' || userRequesting.rol === 'JYP') {
      //El administrador puede filtrar libremente por cualquier usuario_id si lo desea
      if (usuario_id) where.usuario_id = usuario_id;
    } else if (userRequesting.rol === 'CONTADOR') {
      //El contador solo puede ver sus propias acciones o las de los asistentes
      where.usuarios = {
        OR: [
          { id: userRequesting.id }, // Lo suyo
          { rol: 'ASISTENTE' }, // Lo de los asistentes
        ],
      };

      //Si el contador intentó buscar un ID específico en los filtros,
      //validamos que no esté intentando espiar a otro Contador o al Admin.
      if (usuario_id) where.usuario_id = usuario_id; // Prisma unirá este AND con el OR de arriba
    } else
      throw new ForbiddenException(
        'No tiene los privilegios para auditar el sistema.',
      ); //Si por algún motivo otro rol llega aquí (RRHH), le denegamos la vista global

    //Ejecutar la consulta
    const [total, logs] = await this.prisma.$transaction([
      this.prisma.audit_log.count({ where: where }),
      this.prisma.audit_log.findMany({
        where: where,
        skip: skip,
        take: limit,
        orderBy: { created_at: 'desc' }, //Ordenar los resultados por fecha de creación en orden descendente
        //Traer información del usuario que realizó la acción
        include: {
          usuarios: {
            select: {
              email: true,
              rol: true,
              //Traer información del empleado asociado al usuario
              empleados: {
                select: {
                  nro_documento: true,
                  nombre: true,
                  apellido: true,
                },
              },
            },
          },
        },
      }),
    ]);
    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
