import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class obtenerDatosEmpleadoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(idEmpleado: string) {
    //validar la existencia y actividad del empleado
    const empleado = await this.prisma.empleados.findUnique({
      where: {
        id: idEmpleado,
      },
    });
  }
}
