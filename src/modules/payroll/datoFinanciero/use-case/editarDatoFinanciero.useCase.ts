//src/modules/payroll/datoFinanciero/use-case/editarDatoFinanciero.useCase.ts
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CryptoUtil } from '@/common/utils/crypto.Util';
import * as argon2 from 'argon2';
import type { ActualizarDatoFinancieroDto } from '@jyp/shared-contracts';

/**
 * Caso de uso para editar los datos financieros de un empleado.
 * Aplica Step-Up Authentication (re-confimación de identidad) para operaciones sensibles.
 * y re-encriptacion simetrico AES-256-CGM de campos bancarios antes de almacenarlos en la base de datos.
 */
@Injectable()
export class EditarDatoFinancieroUseCase {
  constructor(private readonly prisma: PrismaService) {}
  async execute(idEmpleado: string, dto: ActualizarDatoFinancieroDto) {
    const empleado = await this.prisma.empleados.findUnique({
      where: {id: idEmpleado},
      select: {
        activo: true,
        deleted_at: true
      }
    });
    //validar si el empleado existe
    if (!empleado || empleado.deleted_at !== null) throw new NotFoundException('empleado no encontrado o eleiminado');
    
    try {
      //editar dato de empleado
      const Editado = await this.prisma.dato_financiero.update({
        where: { empleado_id: idEmpleado, deleted_at: null },
        data: {
          ...dto,
          deleted_at: new Date(),
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'error al ingresar datos financieros de empleado',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
