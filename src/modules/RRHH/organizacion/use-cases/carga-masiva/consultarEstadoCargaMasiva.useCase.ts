//src/modules/RRHH/organizacion/use-cases/carga-masiva/consultarEstadoCargaMasiva.useCase.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Caso de uso para consultar el estado de una carga masiva de empleados.
 * Este caso de uso realiza una consulta ligera de solo lectura a la tabla de jobs de carga masiva.
 * Se asegura de que el usuario que realiza la consulta sea el mismo que inició el job, para mantener la seguridad y privacidad.  
 */
@Injectable()
export class ConsultarEstadoCargaMasivaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta una consulta ligera de solo lectura.
   */
  async execute(jobId: string, usuarioId: string) {
    const job = await this.prisma.cargaMasivaJob.findFirst({
      where: {
        id: jobId,
        usuario_id: usuarioId // Medida de seguridad: un RRHH solo puede ver sus propios jobs
      },
      select: {
        id: true,
        estado: true,
        total_registros: true,
        procesados: true,
        fallidos: true,
        errores_detalle: true,
        updated_at: true
      }
    });

    if (!job) throw new NotFoundException(`El lote de carga masiva con ID ${jobId} no existe o no te pertenece.`);

    return job;
  }
}
