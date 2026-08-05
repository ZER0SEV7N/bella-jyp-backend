import { PrismaService } from '@/common/prisma/prisma.service';
import type { CrearComisionDto } from '@jyp/shared-contracts';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class AgregarComisionUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CrearComisionDto) {
    const [validar_tipo, comision_actual] = await Promise.all([
      this.prisma.tipo_afp.findUnique({
        where: { id: dto.tipo_afp_id },
        include: { regimen_pension: true },
      }),
      this.prisma.comisiones_afp.findUnique({
        where: { id: dto.anterior_comision.id },
        select: { id: true, periodo_final: true },
      }),
    ]);

    if (!validar_tipo || validar_tipo.regimen_pension.nombre !== 'AFP') {
      throw new NotFoundException('AFP no encontrada o no acorde al regimen');
    }

    if (!comision_actual || comision_actual.periodo_final !== null) {
      throw new NotFoundException('comision no encontrada o no esta vigente');
    }

    const nuevaComision = await this.prisma.$transaction(async (pr) => {
      await pr.comisiones_afp.update({
        where: { id: dto.anterior_comision.id },
        data: { periodo_final: dto.anterior_comision.periodo_final },
      });
      return pr.comisiones_afp.create({
        data: {
          id: crypto.randomUUID(),
          afp_id: dto.tipo_afp_id,
          ...dto.nueva_comision,
        },
      });
    });

    return nuevaComision;
  }
}
