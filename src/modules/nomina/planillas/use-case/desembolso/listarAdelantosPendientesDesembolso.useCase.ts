//src/modules/nomina/planillas/use-case/desembolso/listarAdelantosPendientesDesembolso.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

/**
 * Caso de uso para listar los adelantos de sueldo aprobados que aún no tienen
 * desembolso registrado (PLA-F9). El contador usa este listado para entregar y
 * definir el período de descuento de cada uno.
 */
@Injectable()
export class ListarAdelantosPendientesDesembolsoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        tipo: 'ADELANTO_SUELDO',
        estado: 'APROBADA',
        deleted_at: null,
        desembolso: { is: null },
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        codigo: true,
        empleado_id: true,
        monto: true,
        fecha_limite: true,
        created_at: true,
        empleados: {
          select: { nombre: true, apellido: true, nro_documento: true },
        },
      },
    });

    return solicitudes.map((solicitud) => ({
      id: solicitud.id,
      codigo: solicitud.codigo,
      empleado_id: solicitud.empleado_id,
      colaborador:
        `${solicitud.empleados.nombre} ${solicitud.empleados.apellido}`.trim(),
      nro_documento: solicitud.empleados.nro_documento,
      monto: solicitud.monto,
      fecha_limite: solicitud.fecha_limite,
      created_at: solicitud.created_at,
    }));
  }
}
