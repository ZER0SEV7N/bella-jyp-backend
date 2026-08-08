import { PrismaService } from '@/common/prisma/prisma.service';
import { editarDatoFinancieroDto } from '@jyp/shared-contracts';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';

@Injectable()
export class editarDatoFinancieroUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(idEmpleado: string, dto: editarDatoFinancieroDto) {
    const empleado = await this.prisma.empleados.findUnique({
      where: {
        id: idEmpleado,
      },
      select: {
        activo: true,
        deleted_at: true,
      },
    });
    //validar si el empleado existe
    if (!empleado || empleado.deleted_at !== null) {
      throw new NotFoundException('empleado no encontrado o eleiminado');
    }
    try {
      //editar dato de empleado
      const dato_financieroEditado = await this.prisma.dato_financiero.update({
        where: { empleado_id: idEmpleado, deleted_at: null },
        data: {
          ...dto,
          deleted_at: new Date(),
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'error al ingresar datos financieros de empleado',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
