//src/modules/core/audit/use-cases/obtenerLogs.useCase.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ObtenerAuditQueryDto } from '@jyp/shared-contracts';
import { calcularCambiosAuditoria } from '../helpers/calcular-cambios-auditoria.helper';
import { TABLAS_PERMITIDAS_RRHH } from '../config/auditoria-tablas.config';
import { ocultarHuellasAuditoria } from '../helpers/ocultar-huellas-auditoria.helper';
import { construirFiltroBase } from '../helpers/construir-filtro-base-auditoria.helper';

/**
 * Caso de uso para consulta de bitácoras e historial de auditoría:
 * - Restringe las tablas visibles por `RRHH` a su ámbito funcional (excluyendo `usuarios`) (`AUD-F4`).
 * - Soporta filtrado por rango de fechas (`desde`, `hasta`) (`AUD-M1`).
 * - Calcula diferencias campo por campo (`cambios` y `campos_modificados`) y expone el historial
 *   por registro o por colaborador (`AUD-M2`).
 */
@Injectable()
export class ObtenerLogsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: ObtenerAuditQueryDto & { desde?: string; hasta?: string },
    userRequesting: { id: string; rol: string }
  ) {
    const {
      page = 1,
      limit = 50,
      tabla_afectada,
      accion,
      usuario_id,
      registro_id,
      desde,
      hasta,
    } = query;
    const skip = (page - 1) * limit;

    const where = construirFiltroBase(userRequesting, {
      tabla_afectada,
      accion,
      usuario_id,
      registro_id,
      desde,
      hasta,
    });

    const [total, logs] = await Promise.all([
      this.prisma.audit_log.count({ where }),
      this.prisma.audit_log.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        omit: { valores_antes: true, valores_despues: true },
        include: {
          usuarios: {
            select: {
              email: true,
              rol: true,
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
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async obtenerPorId(id: string, usuario: { id: string; rol: string }) {
    if (!['ADMIN', 'RRHH', 'CONTADOR'].includes(usuario.rol)) {
      throw new ForbiddenException(
        'No tiene privilegios para auditar el sistema.'
      );
    }

    const where: Prisma.audit_logWhereUniqueInput = { id };
    if (usuario.rol === 'CONTADOR') {
      where.usuarios = { OR: [{ id: usuario.id }, { rol: 'ASISTENTE' }] };
    }

    const registro = await this.prisma.audit_log.findUnique({ where });
    if (!registro) {
      throw new NotFoundException('Registro de auditoría no encontrado.');
    }

    if (
      usuario.rol === 'RRHH' &&
      !(TABLAS_PERMITIDAS_RRHH as readonly string[]).includes(
        registro.tabla_afectada
      )
    ) {
      throw new ForbiddenException(
        'No tiene privilegios para consultar la auditoría de esta tabla.'
      );
    }

    const cambios = calcularCambiosAuditoria(
      registro.valores_antes,
      registro.valores_despues
    );
    //La huella de los campos protegidos solo sirve para comparar; la vista técnica no la muestra.
    return {
      ...registro,
      valores_antes: ocultarHuellasAuditoria(registro.valores_antes),
      valores_despues: ocultarHuellasAuditoria(registro.valores_despues),
      cambios,
      campos_modificados: cambios.map((c) => c.etiqueta),
    };
  }
}
