import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
@Injectable()
export class RenovarContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(idContrato: string) {
    //verificar si el contrato existe
    const contratoValidado = await this.prisma.contratos.findUnique({
      where: { id: idContrato },
      select: {
        empleado_id: true,
        renovado: true,
        id_estado: true,
        deleted_at: true,
        empleados: {
          select: {
            activo: true,
          },
        },
      },
    });
    //validar existencia de contrato
    if (!contratoValidado || contratoValidado.deleted_at !== null) {
      throw new NotFoundException('contrato no encontrado o fue eliminado');
    }
    //validar el empleado
    if (
      !contratoValidado.empleados ||
      contratoValidado.empleados.activo !== true
    ) {
      throw new NotFoundException(
        'Empleado no encontrado o no cumple con lo rqueisitos',
      );
    }
    try {
      //renovar contrato
      const contratoRenovado = await this.prisma.contratos.update({
        where: {
          id: idContrato,
        },
        data: {
          renovado: true,
        },
      });
      return contratoRenovado;
    } catch (error) {
      throw new InternalServerErrorException(
        'error al renova contrato',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
