//src/modules/RRHH/use-cases/empleado/editarEmpleado.useCase.ts
//Case de uso para editar un empleado en la base de datos.
//Se encarga de validar la existencia del empleado, verificar que el documento no esté duplicado y actualizar los datos del empleado en la base de datos.
//Maneja excepciones para casos de empleado no encontrado, documento duplicado y errores internos durante la actualización.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EditarEmpleadoDto } from '@jyp/shared-contracts';

@Injectable()
export class EditarEmpleadoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(id: string, payload: EditarEmpleadoDto) {
    try {
      //Buscar el empleado por su ID
      const empleado = await this.prisma.empleados.findUnique({where: { id }});

      if (!empleado || empleado.deleted_at !== null) throw new NotFoundException({
        title: 'Colaborador no encontrado',
        detail: 'El legajo no existe o ha sido eliminado (cesado).'
      });

      // Si intenta cambiar el documento, validamos que no colisione con otro
      if (
        payload.nro_documento &&
        payload.nro_documento !== empleado.nro_documento
      ) {
        const docExistente = await this.prisma.empleados.findUnique({
          where: { nro_documento: payload.nro_documento },
        });

        if (docExistente)
          throw new BadRequestException({
            title: 'Documento Duplicado',
            detail: `El DNI/Documento ${payload.nro_documento} ya pertenece a otro colaborador.`,
          });
      }

      const empleadoActualizado = await this.prisma.empleados.update({
        where: { id },
        data: {
          cargo_id: payload.cargo_id,
          area_id: payload.area_id,
          documento_id: payload.documento_id,
          estado_empleado_id: payload.estado_empleado_id,
          nro_documento: payload.nro_documento,
          nombre: payload.nombre,
          apellido: payload.apellido,
          fecha_nacimiento: payload.fecha_nacimiento
            ? new Date(payload.fecha_nacimiento)
            : undefined,
          fecha_inicio: payload.fecha_inicio
            ? new Date(payload.fecha_inicio)
            : undefined,
          asig_familiar: payload.asig_familiar,
        },
      });

      return empleadoActualizado;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;

      throw new BadRequestException({
        title: 'Error de Actualización',
        detail:
          'Fallo interno al intentar modificar el legajo del colaborador.',
      });
    }
  }
}
