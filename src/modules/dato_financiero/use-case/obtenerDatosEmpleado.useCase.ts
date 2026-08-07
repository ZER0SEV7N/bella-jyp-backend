import { PrismaService } from '@/common/prisma/prisma.service';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class obtenerDatosEmpleadoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(idEmpleado: string) {
    //validar la existencia y actividad del empleado
    const empleado = await this.prisma.empleados.findUnique({
      where: {
        id: idEmpleado,
      },
      select: {
        id: true,
        activo: true,
        deleted_at: true,
      },
    });
    //validar empleado
    if (!empleado || empleado.deleted_at !== null || empleado.activo !== true) {
      throw new NotFoundException('empleado no encontrado o inactivo');
    }
    try {
      //datos financiero de empleado
      const daots_financiero = await this.prisma.dato_financiero.findUnique({
        where: {
          empleado_id: empleado.id,
          deleted_at: null,
        },
        select: {
          id: true,
          cuenta_bancaria: true,
          sueldo_basico: true,
          cuspp: true,
          tipo_comision: true,
          cci: true,
          nro_cuenta_cts: true,
          empleados: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
            },
          },
          regimen_pension: {
            select: {
              nombre: true,
            },
          },
          bancos: {
            select: {
              nombre: true,
            },
          },
        },
      });
      return daots_financiero;
    } catch (error) {
      throw new InternalServerErrorException(
        'error al ingresar datos financieros de empleado',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
