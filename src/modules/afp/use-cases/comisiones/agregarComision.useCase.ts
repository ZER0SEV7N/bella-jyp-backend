import { PrismaService } from '@/common/prisma/prisma.service';
import type { crearComisionDto } from '@jyp/shared-contracts';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class agregarComisionUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: crearComisionDto) {
    //validar que el tipo de afp exista
    const tipo_afp = await this.prisma.tipo_afp.findUnique({
      where: {
        id: dto.afp_id,
      },
    });
    //validar si es valido
    if (!tipo_afp) {
      throw new NotFoundException('tipo de afp no valido');
    }
    try {
      //agregar nueva comision de AFP
      const comision = await this.prisma.comisiones_afp.create({
        data: {
          id: crypto.randomUUID(),
          ...dto,
        },
      });
      return comision;
    } catch (error) {
      throw new InternalServerErrorException(
        'Ocurrió un error al intentar crear el área',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
