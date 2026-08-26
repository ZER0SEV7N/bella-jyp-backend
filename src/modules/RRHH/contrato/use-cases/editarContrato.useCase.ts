//src/modules/RRHH/contrato/use-cases/editarContrato.useCase.ts
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { EditarContratoDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para editar un contrato en el módulo de RRHH
 * Contiene la lógica de negocio para actualizar un contrato en la base de datos utilizando Prisma.
 * Se encarga de recibir el ID del contrato y los datos a actualizar, validar la existencia del contrato y realizar la actualización.
 * En caso de error, lanza una excepción interna del servidor con un mensaje descriptivo.
 */
@Injectable()
export class EditarContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para editar un contrato
   * Regla de negocio: No se permite cambiar el empleado_id del contrato para evitar fraudes.
   * Regla de negocio: Solo se permite actualizar mientras el pdf del contrato no haya sido subido, es decir, si el campo url es null.
   * @param idContrato El ID del contrato a editar
   * @param dto Los datos del contrato a actualizar
   * @returns Una promesa que resuelve con el contrato actualizado
   * @throws NotFoundException si el contrato no existe o ha sido eliminado
   * @throws BadRequestException si el contrato ya tiene un documento físico adjunto (url no es null)
   * @throws InternalServerErrorException si ocurre un error al actualizar el contrato
   */
  async execute(idContrato: string, dto: EditarContratoDto) {
    //Validar la existencia del contrato antes de intentar actualizarlo
    const contrato = await this.prisma.contratos.findUnique({where: { id: idContrato }});

    if (contrato?.deleted_at !== null) throw new NotFoundException('El contrato especificado no existe o ha sido eliminado.');
    
    //Regla de negocio: Solo se permite actualizar mientras el pdf del contrato no haya sido subido, es decir, si el campo url es null.
    if (contrato.url !== null) throw new BadRequestException('El contrato ha sido sellado. No se puede editar porque ya cuenta con un documento físico adjunto.');

    try {
      return await this.prisma.contratos.update({
        where: { id: idContrato },
        data: { 
          ...dto,
          fecha_inicio: dto.fecha_inicio ? new Date(dto.fecha_inicio) : undefined,
          fecha_fin: dto.fecha_fin ? new Date(dto.fecha_fin) : undefined,
        }
      });
    } catch (error) {
      throw new InternalServerErrorException('Error al actualizar los datos del contrato.');
    }
  }
}