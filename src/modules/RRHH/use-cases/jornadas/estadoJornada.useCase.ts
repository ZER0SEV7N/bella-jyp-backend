//src/modules/RRHH/use-cases/jornadas/estadoJornada.useCase.ts
//Caso de uso para cambiar el estado de una jornada laboral
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class EstadoJornadaUseCase {
      constructor(private readonly prisma: PrismaService) {}

    async desactivar(id: string) {
        //Verificar si la jornada laboral existe y no está eliminada
        const jornada = await this.prisma.jornada.findUnique({ where: { id } });
        if (!jornada || jornada.deleted_at !== null) throw new NotFoundException('La jornada no existe o ya está eliminada.');
        
        //No permitir desactivar la jornada si hay empleados activos asociados a ella
        const empleadosUsando = await this.prisma.empleados.count({ where: { jornada_id: id, activo: true, deleted_at: null } });

        if (empleadosUsando > 0) throw new BadRequestException({
            title: 'Eliminación Bloqueada',
            detail: `Hay ${empleadosUsando} empleado(s) usando este turno. Reasígnalos primero.`,
        });
        
        //Desactivar la jornada laboral
        return await this.prisma.jornada.update({
            where: { id },
            data: { activo: false, deleted_at: new Date() },
        });
    }

    //Reactivar una jornada laboral previamente desactivada
    async reactivar(id: string) {
        return await this.prisma.jornada.update({
           where: { id },
            data: { activo: true, deleted_at: null },
        });
    }
}