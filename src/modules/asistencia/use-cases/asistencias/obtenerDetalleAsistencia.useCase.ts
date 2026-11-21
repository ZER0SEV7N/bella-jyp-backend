//src/modules/asistencia/use-cases/asistencias/obtenerDetalleAsistencia.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { calcularAccionesResumen } from '../../helpers/acciones-resumen.helper';

/**
 * Caso de uso para obtener el detalle de asistencia de un empleado en un período específico (ASI-M4).
 * Consulta el resumen mensual de incidencias y el estado de la planilla del período para calcular las acciones permitidas.
 */
@Injectable()
export class ObtenerDetalleAsistenciaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para obtener el detalle de asistencia de un empleado en un período específico.
   *
   * @param empleadoId - Identificador del empleado para el cual se desea obtener el detalle de asistencia.
   * @param periodo - Período en formato 'YYYY-MM' para el cual se desea obtener el detalle de asistencia.
   * @returns Resumen mensual completo de incidencias del empleado junto con las `acciones` permitidas.
   * @throws {NotFoundException} Si no se encuentra un resumen de incidencias para el período especificado.
   */
  async execute(empleadoId: string, periodo: string) {
    const [resumen, planilla] = await Promise.all([
      this.prisma.incidencias_mes.findUnique({
        where: {
          empleado_id_periodo: { empleado_id: empleadoId, periodo },
        },
      }),
      this.prisma.historial_planillas.findUnique({
        where: {
          empleado_id_periodo: { empleado_id: empleadoId, periodo },
        },
        select: { estado: true },
      }),
    ]);

    if (!resumen) {
      throw new NotFoundException(
        'Primero debe generar las incidencias del período.'
      );
    }

    return {
      ...resumen,
      acciones: calcularAccionesResumen(resumen, planilla?.estado ?? null),
    };
  }
}
