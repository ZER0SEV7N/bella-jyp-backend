//src/modules/RRHH/use-cases/cargos/eliminarCargo.UseCase.ts
//Caso de uso para eliminar un cargo en el módulo de RRHH
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

//Caso de uso
@Injectable()
export class EliminarCargoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string) {
    try {
      //Verificar si el cargo existe y no ha sido eliminado previamente
      const cargo = await this.prisma.cargo.findUnique({ where: { id } });

      if (!cargo || cargo.deleted_at !== null) throw new NotFoundException({
        title: 'Cargo no encontrado',
        detail: 'El cargo no existe o ya se encuentra eliminado.',
      });
      

      //Evitar desactivar un cargo si hay empleados activos ocupándolo
      const empleadosAsignados = await this.prisma.empleados.count({
        where: { 
          cargo_id: id, 
          activo: true,
          deleted_at: null 
        }
      });

      //Si hay empleados activos asignados al cargo, lanzar una excepción para bloquear la eliminación
      if (empleadosAsignados > 0) throw new BadRequestException({
        title: 'Eliminación bloqueada',
        detail: `Este cargo está siendo ocupado por ${empleadosAsignados} empleado(s) activo(s). Debe reasignarlos antes de desactivar el cargo.`,
      });

      const cargoEliminado = await this.prisma.cargo.update({
        where: { id },
        data: {
          activo: false,
          deleted_at: new Date(), 
        },
      });

      return cargoEliminado;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      
      throw new BadRequestException({
        title: 'Error Interno',
        detail: 'Fallo al intentar desactivar el cargo.',
      });
    }
  }
}