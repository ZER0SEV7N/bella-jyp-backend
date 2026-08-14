//src/modules/RRHH/contrato/use-cases/listarContrato.useCase.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
/**
 * Caso de uso para obtener un contrato por su ID en el módulo de RRHH
 * Contiene la lógica de negocio para buscar un contrato en la base de datos utilizando Prisma.
 * Se encarga de recibir el ID del contrato, validar su existencia y devolver la información correspondiente.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */

@Injectable()
export class ListarContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para obtener un contrato por su ID
   * @param idEmpleado El ID del empleado asociado al contrato
   * @returns Una promesa que resuelve con el contrato encontrado
   * @throws NotFoundException si el contrato no existe o ha sido eliminado
   * @throws InternalServerErrorException si ocurre un error al buscar el contrato
   */
  async execute(idEmpleado: string) {

    const empleado = await this.prisma.empleados.findUnique({ where: { id: idEmpleado, deleted_at: null }, 
      select: { id: true, nombre: true, apellido: true, numero_documento: true }
    });

    if(!empleado) throw new NotFoundException('Empleado no encontrado o eliminado de la db');

    try {
      //Buscar los contratos asociado al empleado en la base de datos utilizando Prisma
      const contratos = await this.prisma.contratos.findMany({
          where: {
            empleado_id: idEmpleado,
            deleted_at: null
          },
          orderBy: { fecha_inicio: 'desc' },
          include: { estado_contrato: {
            select: {nombre: true }
          }}
      });
      return {
        empleado: `${empleado.nombre} ${empleado.apellido}`.trim(),
        documento: empleado.numero_documento,
        contratos: contratos
      };
    } catch (error) {
      throw new InternalServerErrorException('Error al buscar el historial de contratos.', error instanceof Error ? error.message : String(error));
    }
  }
}
