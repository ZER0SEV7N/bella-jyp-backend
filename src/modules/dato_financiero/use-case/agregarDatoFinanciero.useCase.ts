//se agregaran datos financieros de empleados
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { crearDatoFinancieroDto } from '@jyp/shared-contracts';

@Injectable()
export class agregarDatosFinancieroUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(dto: crearDatoFinancieroDto) {
    //validar que el empleado existe
    const [empleado, banco, regimen] = await Promise.all([
      this.prisma.empleados.findUnique({ where: { id: dto.empleado_id } }),
      this.prisma.bancos.findUnique({ where: { id: dto.id_banco } }),
      this.prisma.regimen_pension.findUnique({ where: { id: dto.id_banco } }),
    ]);
    //validar la exsitensia y actividad de empleado
    if (
      !empleado ||
      empleado.activo !== false ||
      empleado.deleted_at !== null
    ) {
      throw new NotFoundException('empleado no valido');
    }
    //validar la existencia del banco
    if (!banco) {
      throw new NotFoundException('banco no encontrado');
    }
    if (!regimen) {
      throw new NotFoundException('regimen no valido');
    }
    try {
      //ingrezar dato financiero de empleado
      const datos = await this.prisma.dato_financiero.create({
        data: { id: crypto.randomUUID(), ...dto },
      });
      return datos;
    } catch (error) {
      throw new InternalServerErrorException(
        'error al ingresar datos financieros de empleado',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
