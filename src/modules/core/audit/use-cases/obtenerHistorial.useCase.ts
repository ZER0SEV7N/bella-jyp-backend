//src/modules/core/audit/use-cases/obtenerLogs.useCase.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { calcularCambiosAuditoria } from '../helpers/calcular-cambios-auditoria.helper';
import { construirFiltroBase } from '../helpers/construir-filtro-base-auditoria.helper';

/**
 * Caso de uso para consulta de bitácoras e historial de auditoría:
 * - Restringe las tablas visibles por `RRHH` a su ámbito funcional (excluyendo `usuarios`) (`AUD-F4`).
 * - Soporta filtrado por rango de fechas (`desde`, `hasta`) (`AUD-M1`).
 * - Calcula diferencias campo por campo (`cambios` y `campos_modificados`) y expone el historial
 *   por registro o por colaborador (`AUD-M2`).
 */
@Injectable()
export class ObtenerHistorialUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve el historial paginado de cambios de un registro específico (`GET /core/audit/historial/:tabla/:registroId`) (AUD-M2).
   */
  async obtenerHistorialRegistro( tabla: string, registroId: string, usuario: { id: string; rol: string }, page = 1, limit = 20 ) {
    const where = construirFiltroBase(usuario, {
      tabla_afectada: tabla,
      registro_id: registroId,
    });
    const skip = (page - 1) * limit;

    const [total, filas] = await this.prisma.$transaction([
      this.prisma.audit_log.count({ where }),
      this.prisma.audit_log.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          usuarios: {
            select: {
              id: true,
              rol: true,
              empleados: { select: { nombre: true, apellido: true } },
            },
          },
        },
      }),
    ]);

    const data = filas.map((fila) => {
      const cambios = calcularCambiosAuditoria(fila.valores_antes, fila.valores_despues);
      return {
        id: fila.id,
        fecha: fila.created_at,
        accion: fila.accion,
        tabla_afectada: fila.tabla_afectada,
        registro_id: fila.registro_id,
        usuario: fila.usuarios
          ? {
              id: fila.usuarios.id,
              nombre: fila.usuarios.empleados
                ? `${fila.usuarios.empleados.nombre} ${fila.usuarios.empleados.apellido}`.trim()
                : 'Sistema',
              rol: fila.usuarios.rol,
            }
          : null,
        cambios,
        campos_modificados: cambios.map((c) => c.etiqueta),
      };
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}