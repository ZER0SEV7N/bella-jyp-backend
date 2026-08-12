import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
@Injectable()
export class ObtenerContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(idContrato: string) {
    //validar si el contrato exsite
    const validar = await this.prisma.contratos.findUnique({
      where: { id: idContrato },
      select: {
        id: true,
        deleted_at: true
      }
    });
    
    if (!validar || validar.deleted_at !== null) 
      throw new NotFoundException('contrato no exitente o eliminado de la db');
    
    //inciar
    try {
      //encontrat con prisma
      const contrato = this.prisma.contratos.findUnique({
        where: { id: idContrato },
        select: {
          id: true,
          estado_contrato: true,
          url: true,
          empleado_id: true
        }
      });
      return contrato;
    } catch (error) {
      throw new InternalServerErrorException('error al buscar contrato', error instanceof Error ? error.message : String(error));
    }
  }
}
