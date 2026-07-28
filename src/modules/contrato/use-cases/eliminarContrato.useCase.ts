import {
  //Injectable,
  NotFoundException,
  //BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

export class EliminarContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(idContrato: string) {
    //validar si el contrato existe
    const validar = await this.prisma.contratos.findUnique({
      where: { id: idContrato },
      select: {
        deleted_at: true,
        empleado_id: true,
        renovado: true,
        fecha_fin: true,
        id_estado: true,
      },
    });
    //validar
    if (!validar || validar.deleted_at !== null) {
      throw new NotFoundException('contrato no encontrado o  ya eliminado');
    }
    //incio de las modificaciones
    try {
      const contratoeditado = await this.prisma.contratos.update({
        where: { id: idContrato },
        data: {
          deleted_at: new Date(),
        },
      });
      return contratoeditado;
    } catch (error) {
      throw new InternalServerErrorException(
        'ocurrio un error al editar daots del contrato',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
