import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { editarContratDto } from '@jyp/shared-contracts';

@Injectable()
export class EditarContratoUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: editarContratDto, idContrato: string) {
    //encontrar empleado
    const empeladoValidado = await this.prisma.empleados.findUnique({
      where: {
        id: dto.empleado_id,
        activo: true,
      },
    });
    //validar empleado existe
    const contrato = await this.prisma.contratos.findUnique({
      where: {
        id: idContrato,
      },
    });
    //validacion de empleados
    if (!empeladoValidado)
      throw new NotFoundException('empleado no existente o inactivo');
    //validacion de contrato
    if (!contrato || contrato.deleted_at !== null) {
      throw new NotFoundException('contrato no existente o inactivo');
    }
    try {
      const contratoEditado = await this.prisma.contratos.update({
        data: { ...dto },
        where: { id: idContrato },
      });
      return contratoEditado;
    } catch (error) {
      throw new InternalServerErrorException(
        'ocurrio un error al editar daots del contrato',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
