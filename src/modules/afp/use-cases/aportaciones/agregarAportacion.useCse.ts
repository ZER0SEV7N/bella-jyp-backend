import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AportacionesDto } from '@jyp/shared-contracts';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class agregarAportacionUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: AportacionesDto) {
    //crear aportacion
    try {
      const AportacionCreada = await this.prisma.aportaciones.create({
        data: { id: crypto.randomUUID(), ...dto },
      });
      return AportacionCreada;
    } catch (error) {
      throw new InternalServerErrorException(
        'Ocurrió un error al intentar crear el área',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
