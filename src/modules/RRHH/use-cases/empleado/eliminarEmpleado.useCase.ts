//src/modules/RRHH/use-cases/empleado/eliminarEmpleado.UseCase.ts
//Caso de uso para eliminar un empleado (soft delete) en el módulo de RRHH
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
@Injectable()
export class EliminarEmpleadoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    try {
      //Buscar el empleado por su ID
      const empleado = await this.prisma.empleados.findUnique({ where: { id } });

      if (!empleado || empleado.deleted_at !== null) throw new NotFoundException({
        title: 'Colaborador no encontrado',
        detail: 'El legajo no existe o ya se encuentra eliminado.',
      });
      
      //Realizar un "soft delete" del empleado, marcando el campo "activo" como false y estableciendo la fecha de cese y deleted_at
      const empleadoEliminado = await this.prisma.empleados.update({
        where: { id },
        data: {
          activo: false,
          fecha_cese: new Date(), //Marcamos la fecha de cese automáticamente
          deleted_at: new Date(), 
        },
      });

      return empleadoEliminado;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      
      throw new BadRequestException({
        title: 'Error al eliminar legajo',
        detail: 'Ocurrió un error al intentar procesar la baja del colaborador.',
      });
    }
  }
}