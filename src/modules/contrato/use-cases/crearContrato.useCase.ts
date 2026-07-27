import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { datosContratoDto } from '@jyp/shared-contracts';
@Injectable()
export class CrearContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(datosContrato: datosContratoDto) {
    //crear uuid
    try {
      const contrato = await this.prisma.contratos.create({
        data: datosContrato,
      });
      return contrato;
    } catch (error) {
      throw new InternalServerErrorException(
        'Ocurrió un error al intentar crear el área',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
