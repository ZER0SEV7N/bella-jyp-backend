import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { dtoCreateEmpleado, createEmpleadoSchema } from '@jyp/shared-contracts';

@Injectable()
export class CrearEmpleadoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: dtoCreateEmpleado) {
    //validar con zod
    const data = createEmpleadoSchema.parse(dto);
    try {
      //crear empleado con prisma
      const empleadoCreado = await this.prisma.empleados.create({
        data: {
          id: crypto.randomUUID(),
          ...data,
        },
      });
      return {
        state: true,
        message: 'Empleado creado correctamente',
        data: empleadoCreado,
      };
    } catch (error) {
      throw new BadRequestException({
        type: 'https://api.jyp.com/errors/bad-request',
        title: 'Error al crear el empleado',
        detail:
          'No se pudo guardar en la base de datos. Verifica que el nombre no esté duplicado.',
      });
    }
  }
}
