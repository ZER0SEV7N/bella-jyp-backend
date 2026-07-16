import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { deleteEmpleadoSchema } from '@jyp/shared-contracts';
@Injectable()
export class DeleteEmpleadoUseCase {
  //constructor
  constructor(private readonly prisma: PrismaService) {}
  async execute(idEmpleado: string) {
    //validar con zod
    const { id } = deleteEmpleadoSchema.parse({ id: idEmpleado });
    try {
      //ejecutar prisma
      const empleadoElimnado = await this.prisma.empleados.update({
        where: { id: id },
        data: {
          activo: false,
          deleted_at: new Date(),
        },
      });
      //retorno
      return {
        state: true,
        message: 'Empleado deshabilitado correctamente',
        data: empleadoElimnado,
      };
    } catch (error) {
      throw new BadRequestException({
        type: 'https://api.jyp.com/errors/bad-request',
        title: 'Error al crear el área',
        detail:
          'No se pudo guardar en la base de datos. Verifica que el nombre no esté duplicado.',
      });
    }
  }
}
