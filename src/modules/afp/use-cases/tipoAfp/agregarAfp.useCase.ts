import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { crearTipoAfpDto } from '@jyp/shared-contracts';

@Injectable()
export class agregarTipoAfpUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: crearTipoAfpDto) {
    //validar si el regimen es aft
    const regimen = await this.prisma.regimen_pension.findUnique({
      where: {
        id: dto.id_regimen,
      },
      select: {
        id: true,
        nombre: true,
      },
    });
    //validar que sea afp
    if (!regimen || regimen.nombre !== 'AFP') {
      throw new NotFoundException('regimen no encontrado o valido');
    }
    try {
      //crear nuevo tipo de afp
      const nuevoTipo = await this.prisma.tipo_afp.create({
        data: { id: crypto.randomUUID(), ...dto },
      });
      return nuevoTipo;
    } catch (error) {
      throw new InternalServerErrorException(
        'Ocurrió un error al intentar crear el área',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
