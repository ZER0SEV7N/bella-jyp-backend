//src/modules/RRHH/contrato/use-cases/listarContrato.useCase.ts
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { ListarContratosQueryDto } from '@jyp/shared-contracts';
import dayjs from 'dayjs';

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
    const { page = 1, limit = 10, search, empleado_id, id_estado, area_id, por_vencer_dias, renovado } = query;
    const skip = (page - 1) * limit;

    try {

      if (empleado_id) {
        const empleado = await this.prisma.empleados.findUnique({
          where: { id: empleado_id, deleted_at: null },
          select: { id: true, nombre: true, apellido: true, nro_documento: true },
        });

        if (!empleado) throw new NotFoundException('Empleado no encontrado o dado de baja de la base de datos.');
        
      }
      //Construccion dinamica del objeto "where" para filtrar contratos según los parámetros de búsqueda
      const where: any = { deleted_at: null };

      if (empleado_id) where.empleado_id = empleado_id;
      if (id_estado) where.id_estado = id_estado;
      if (renovado !== undefined) where.renovado = renovado;
    
      //Filtro para contratos que están por vencer en un rango de días especificado
      if (por_vencer_dias) {
        const hoy = dayjs().startOf('day').toDate();
        const fechaTope = dayjs().add(por_vencer_dias, 'day').endOf('day').toDate();

        //Solo incluir contratos que no han sido renovados y cuya fecha de fin esté dentro del rango especificado
        where.renovado = false;
        where.fecha_fin = {
          gte: hoy,
          lte: fechaTope
        };
      }

      //Filtros adicionales para buscar por nombre, apellido o número de documento del empleado, y por área
      const empleadoWhere: any = {
        deleted_at: null,
        activo: true,
      };

      if (area_id) empleadoWhere.area_id = area_id;

      if (search) {
        empleadoWhere.OR = [
          { nombre: { contains: search, mode: 'insensitive' } },
          { apellido: { contains: search, mode: 'insensitive' } },
          { nro_documento: { contains: search } }
        ];
      }

      if (Object.keys(empleadoWhere).length > 2 || area_id || search) where.empleados = empleadoWhere;
      

      // 2. Consulta en paralelo (Conteo total + Registros)
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
              },
            },
            estado_contrato: { select: { id: true, nombre: true } },
          },
        }),
      ]);

      //Procesamiento de los contratos para calcular días restantes y alertas de vencimiento
      const hoy = dayjs();
      const data = contratos.map((c) => {
      const diasRestantes = c.fecha_fin ? dayjs(c.fecha_fin).diff(hoy, 'day') : null;
      const alertaVencimiento = diasRestantes !== null ? this.calcularAlertaVencimiento(diasRestantes) : null;

        return {
          id: c.id,
          empleado_id: c.empleado_id,
          colaborador: `${c.empleados.nombre ?? ''} ${c.empleados.apellido ?? ''}`.trim(),
          nro_documento: c.empleados.nro_documento,
          area: c.empleados.area?.nombre ?? 'Sin Área',
          cargo: c.empleados.cargo?.nombre ?? 'Sin Cargo',
          estado: c.estado_contrato?.nombre ?? 'DESCONOCIDO',
          tipo_modalidad: c.tipo_modalidad ?? 'No especificado',
          fecha_inicio: c.fecha_inicio,
          fecha_fin: c.fecha_fin,
          dias_restantes: diasRestantes,
          alerta_vencimiento: alertaVencimiento,
          renovado: c.renovado,
          url_documento: c.url,
          tiene_archivo: Boolean(c.url),
          observacion: c.observacion
        };
      });

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit)  }
      };
    } catch (error) {
      // Permitir que las excepciones controladas de NestJS se propaguen
      if (error instanceof NotFoundException) throw error;
      

      throw new InternalServerErrorException('Error al consultar el listado de contratos.', error instanceof Error ? error.message : String(error));
    }
  }

  private calcularAlertaVencimiento(dias: number): AlertaVencimiento {
    switch (true) {
      case dias < 0:
        return 'VENCIDO';
      case dias <= 15:
        return 'CRITICO';
      case dias <= 30:
        return 'PREVENTIVO';
      default:
        return 'REGULAR';
    }
  }
}