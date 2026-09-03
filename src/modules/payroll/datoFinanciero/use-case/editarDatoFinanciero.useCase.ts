//src/modules/payroll/datoFinanciero/use-case/editarDatoFinanciero.useCase.ts
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CryptoUtil } from '@/common/utils/crypto.util';
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

  /**
   * Ejecuta el caso de uso para editar los datos financieros de un empleado.
   * @param idEmpleado - El ID del empleado.
   * @param dto - Los datos a actualizar.
   * @param idUsuario - El ID del usuario autenticado.
   * @returns Una promesa que se resuelve con los datos actualizados.
   */
  async execute(idEmpleado: string, dto: ActualizarDatoFinancieroDto, idUsuario: string) {
    //Validar que el dato financiero del empleado existe y no ha sido desactivado
    const datoFinanciero = await this.prisma.dato_financiero.findUnique({where: { empleado_id: idEmpleado }});

    if (datoFinanciero?.deleted_at !== null) 
      throw new NotFoundException('El dato financiero del empleado no existe o ha sido desactivado.');
    
    //Validar que el usuario autenticado es el mismo que realiza la operación y que su contraseña es correcta
    const usuarioActual = await this.prisma.usuarios.findUnique({
      where: { id: idUsuario, deleted_at: null },
      select: { password_hash: true }
    });

    if (!usuarioActual) throw new UnauthorizedException('Usuario no autorizado.');
    
    //Verificar la contraseña de confirmación proporcionada en el DTO
    const passwordValida = await argon2.verify(
      usuarioActual.password_hash,
      dto.password_confirmacion
    );

    if (!passwordValida) throw new UnauthorizedException({
      title: 'Confirmación de Seguridad Fallida',
      detail: 'La contraseña de confirmación ingresada es incorrecta. Mutación financiera denegada.'
    });

    try {
      //Re-encriptar los campos sensibles antes de actualizar la base de datos
      const cuentaEncrypted = dto.cuenta_bancaria !== undefined ? CryptoUtil.encrypt(dto.cuenta_bancaria) : undefined;

      const cciEncrypted = dto.cci !== undefined ? CryptoUtil.encrypt(dto.cci): undefined;

      const ctsEncrypted = dto.nro_cuenta_cts !== undefined ? CryptoUtil.encrypt(dto.nro_cuenta_cts) : undefined;

      //Actualizar los datos financieros del empleado en la base de datos
      const actualizado = await this.prisma.dato_financiero.update({
        where: { empleado_id: idEmpleado },
        data: {
          id_regimen: dto.id_regimen,
          id_tipo_afp: dto.id_tipo_afp,
          id_banco: dto.id_banco,
          cuenta_bancaria: cuentaEncrypted,
          cci: cciEncrypted,
          nro_cuenta_cts: ctsEncrypted,
          sueldo_basico: dto.sueldo_basico,
          cuspp: dto.cuspp,
          tipo_comision: dto.tipo_comision
        }
      });

      return {
        id: actualizado.id,
        empleado_id: actualizado.empleado_id,
        mensaje: 'Datos financieros actualizados y re-encriptados correctamente.'
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      throw new InternalServerErrorException(`Error al actualizar los datos financieros del empleado. ${message}`);
    }
  }
}