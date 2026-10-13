//src/modules/RRHH/contrato/use-cases/listarContrato.useCase.ts
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarContratosQueryDto } from '@jyp/shared-contracts';
import dayjs from 'dayjs';
import { Prisma, estado_contrato_enum } from '@prisma/client';

//Definición de los posibles estados de alerta para el vencimiento de un contrato
type AlertaVencimiento = 'VENCIDO' | 'CRITICO' | 'PREVENTIVO' | 'REGULAR';

/**
 * Caso de uso para listar los contratos asociados a un empleado.
 * Este caso de uso permite obtener todos los contratos activos y sus detalles,
 * filtrando por el ID del empleado y otros parámetros opcionales como estado, área, días para vencimiento y si ha sido renovado.
 * Los contratos se ordenan de manera descendente por fecha de inicio, a menos que se especifique un filtro de vencimiento.
 */
@Injectable()
export class ListarContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para listar contratos.
   * Utiliza los parámetros de consulta proporcionados para filtrar y paginar los resultados.
   * @param query - Parámetros de consulta que incluyen paginación, búsqueda por empleado, estado, área, días para vencimiento y si ha sido renovado.
   * @returns - Un objeto que contiene la lista de contratos y metadatos de paginación.
   * @throws NotFoundException si el empleado especificado no existe.
   * @throws InternalServerErrorException si ocurre un error al consultar la base de datos.
   */
  async execute(query: ListarContratosQueryDto) {
    //Desestructurar los parámetros de consulta con valores predeterminados
    const { page = 1, limit = 10, search, empleado_id, estado, area_id, por_vencer_dias } = query;
    const skip = (page - 1) * limit;

    try {
      //Validar la existencia del empleado si se proporciona un ID
      if (empleado_id) {
        const empleado = await this.prisma.empleados.findUnique({ where: { id: empleado_id, deleted_at: null }, select: { id: true }});
        if (!empleado) throw new NotFoundException('Empleado no encontrado o inactivo.');
      }

      const where: Prisma.contratosWhereInput = { deleted_at: null };

      if (empleado_id) where.empleado_id = empleado_id;
      if (estado) where.estado = estado as estado_contrato_enum;

      //Filtro de vencimiento próximo para contratos vigentes
      if (por_vencer_dias) {
        const hoy = dayjs().startOf('day').toDate();
        const fechaTope = dayjs().add(por_vencer_dias, 'day').endOf('day').toDate();

        where.estado = estado_contrato_enum.VIGENTE;
        where.fecha_fin = {
          gte: hoy,
          lte: fechaTope
        };
      }

      //Filtro anidado por colaborador / área
      if (area_id || search) {
        where.empleados = {
          deleted_at: null,
          activo: true,
          ...(area_id && { area_id }),
          ...(search && {
            OR: [
              { nombre: { contains: search.trim(), mode: 'insensitive' } },
              { apellido: { contains: search.trim(), mode: 'insensitive' } },
              { nro_documento: { contains: search.trim() } }
            ]
          })
        };
      }

      //Realizar la consulta de contratos y el conteo total en paralelo para optimizar el rendimiento
      const [total, contratos] = await Promise.all([
        this.prisma.contratos.count({ where }),
        this.prisma.contratos.findMany({
          where,
          skip,
          take: limit,
          orderBy: por_vencer_dias ? { fecha_fin: 'asc' } : { fecha_inicio: 'desc' },
          include: {
            empleados: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                nro_documento: true,
                area: { select: { id: true, nombre: true } },
                cargo: { select: { id: true, nombre: true } },
              }
            }
          }
        })
      ]);

      //Calcular los días restantes y el estado de alerta para cada contrato, y preparar la respuesta final
      const hoy = dayjs();
      const data = contratos.map((c) => {
        const diasRestantes = c.fecha_fin ? dayjs(c.fecha_fin).diff(hoy, 'day') : null;
        const alertaVencimiento =
          diasRestantes !== null ? this.calcularAlertaVencimiento(diasRestantes) : null;

        //Construir el objeto de contrato con los campos requeridos para la respuesta
        return {
          id: c.id,
          empleado_id: c.empleado_id,
          colaborador: `${c.empleados?.nombre ?? ''} ${c.empleados?.apellido ?? ''}`.trim(),
          nro_documento: c.empleados?.nro_documento ?? '',
          area: c.empleados?.area?.nombre ?? 'Sin Área',
          cargo: c.empleados?.cargo?.nombre ?? 'Sin Cargo',
          estado: c.estado,
          tipo_modalidad: c.tipo_modalidad ?? 'No especificado',
          fecha_inicio: c.fecha_inicio,
          fecha_fin: c.fecha_fin,
          dias_restantes: diasRestantes,
          alerta_vencimiento: alertaVencimiento,
          contrato_origen_id: c.contrato_origen_id,
          es_prorroga: Boolean(c.contrato_origen_id),
          url_documento: c.url,
          tiene_archivo: Boolean(c.url),
          observacion: c.observacion,
        };
      });

      //Devolver la respuesta con los datos y metadatos de paginación
      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException(
        'Error al consultar el listado de contratos.',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Funcion privada para calcular el estado de alerta de vencimiento de un contrato basado en los días restantes.
   * @param dias - Los días restantes hasta la fecha de fin del contrato.
   * @returns - Un string que representa el estado de alerta: 'VENCIDO', 'CRITICO', 'PREVENTIVO' o 'REGULAR'.
   * - 'VENCIDO' si los días restantes son negativos.
   * - 'CRITICO' si los días restantes son 15 o menos.
   * - 'PREVENTIVO' si los días restantes son entre 16 y 30.
   * - 'REGULAR' si los días restantes son más de 30.
   */
  private calcularAlertaVencimiento(dias: number): AlertaVencimiento {
    if (dias < 0) return 'VENCIDO';
    if (dias <= 15) return 'CRITICO';
    if (dias <= 30) return 'PREVENTIVO';
    return 'REGULAR';
  }
}