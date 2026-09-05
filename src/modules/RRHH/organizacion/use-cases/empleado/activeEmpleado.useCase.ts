//src/modules/RRHH/use-cases/empleado/activeEmpleado.useCase.ts
//Caso de uso para reactivar un empleado (soft delete) en el módulo de RRHH
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class ActiveEmpleadoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(idEmpleado: string) {
    try {
      //Validar que el ID proporcionado sea un UUID válido
      const idValidado = z.uuid().parse(idEmpleado);

      const data = await this.prisma.empleados.update({
        where: { id: idValidado },
        data: {
          activo: true,
          fecha_nacimiento: null, //Limpiamos la fecha de nacimiento
          fecha_inicio: null, //Limpiamos la fecha de inicio
          fecha_cese: null, //Limpiamos la fecha de cese
          deleted_at: null, //Restauramos el soft-delete
        },
      });

      return {
        state: true,
        message:
          'Colaborador reactivado correctamente. Verifique sus contratos y AFP.',
        data: data,
      };
    } catch (error) {
      throw new BadRequestException({
        title: 'Error al reactivar',
        detail: 'No se pudo realizar la operación, asegúrate de que el ID sea correcto.'
      });
    }
  }
}
