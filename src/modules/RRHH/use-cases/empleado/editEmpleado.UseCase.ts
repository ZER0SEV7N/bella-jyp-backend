import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { z } from 'zod';
import { dtoEditEmpleado, editEmpleadoSchema } from '@jyp/shared-contracts';

@Injectable()
export class EditEmpleadoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(id: string, dto: dtoEditEmpleado) {
    //validar id
    const idValidado = z.uuid().parse(id);
    //validar data
    const dtoValidado = editEmpleadoSchema.parse(dto);
    //iniciar update
    try {
      //comenzar con prisma
      const data = await this.prisma.empleados.update({
        where: { id: idValidado },
        data: dtoValidado,
      });
      return {
        state: true,
        message: 'Empelado actulziado correctamente',
        data: data,
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
