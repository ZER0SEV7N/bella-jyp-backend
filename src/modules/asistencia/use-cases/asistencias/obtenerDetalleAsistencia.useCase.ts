import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';

/** Consulta el detalle diario guardado al generar incidencias. */
@Injectable()
export class ObtenerDetalleAsistenciaUseCase {
    constructor(private readonly prisma: PrismaService) {}

    async execute(empleadoId: string, periodo: string) {
        const resumen = await this.prisma.incidencias_mes.findUnique({ where: { empleado_id_periodo: { empleado_id: empleadoId, periodo } } });
        if (!resumen) throw new NotFoundException('Primero debe generar las incidencias del período.');
        return resumen;
    }
}
