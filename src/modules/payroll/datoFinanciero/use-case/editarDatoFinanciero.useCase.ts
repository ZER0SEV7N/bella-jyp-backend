//src/modules/payroll/datoFinanciero/use-case/editarDatoFinanciero.useCase.ts
import { Injectable, NotFoundException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import * as argon2 from 'argon2';
import type { ActualizarDatoFinancieroDto } from '@jyp/shared-contracts';
import { encriptarDatoBancario, validarEntidadesFinancieras } from './helper/validacionesDatoFinanciero.helper';
import { sanitizarTexto } from '@/common/utils/transformacion.util';

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
    const datoFinanciero = await this.prisma.dato_financiero.findUnique({
      where: { empleado_id: idEmpleado },
    });

    if (!datoFinanciero || datoFinanciero.deleted_at !== null) 
      throw new NotFoundException('El dato financiero del colaborador no existe o ha sido desactivado.');
    
    //Step-Up Authentication: validación de credenciales para mutaciones sensibles
    const usuarioActual = await this.prisma.usuarios.findUnique({
      where: { id: idUsuario, deleted_at: null },
      select: { password_hash: true }
    });

    if (!usuarioActual) throw new UnauthorizedException('Usuario no autorizado.');

    const passwordValida = await argon2.verify(usuarioActual.password_hash, dto.password_confirmacion);

    if (!passwordValida) throw new UnauthorizedException({
      title: 'Confirmación de Seguridad Fallida',
      detail: 'La contraseña ingresada es incorrecta. Operación financiera denegada.'
    });
    
    //Validar entidades foráneas enviadas en la actualización
    await validarEntidadesFinancieras(this.prisma, dto);

    try {
      const actualizado = await this.prisma.dato_financiero.update({
        where: { empleado_id: idEmpleado },
        data: {
          id_regimen: dto.id_regimen,
          id_tipo_afp: dto.id_tipo_afp,
          sueldo_basico: dto.sueldo_basico,
          cuspp: sanitizarTexto(dto.cuspp),
          tipo_comision: sanitizarTexto(dto.tipo_comision),

          // Sueldo (encriptación limpia sin ternarios anidados)
          id_banco_sueldo: dto.id_banco_sueldo,
          tipo_cuenta_sueldo: dto.tipo_cuenta_sueldo,
          nro_cuenta_sueldo: encriptarDatoBancario(dto.nro_cuenta_sueldo),
          cci_sueldo: encriptarDatoBancario(dto.cci_sueldo),

          // CTS
          id_banco_cts: dto.id_banco_cts,
          tipo_cuenta_cts: dto.tipo_cuenta_cts,
          nro_cuenta_cts: encriptarDatoBancario(dto.nro_cuenta_cts),
          cci_cts: encriptarDatoBancario(dto.cci_cts),

          // Salud y EPS
          regimen_salud: dto.regimen_salud,
          eps_nombre: sanitizarTexto(dto.eps_nombre),
          eps_plan: sanitizarTexto(dto.eps_plan),
          eps_costo_adicional: dto.eps_costo_adicional,
        },
      });

      return {
        id: actualizado.id,
        empleado_id: actualizado.empleado_id,
        mensaje: 'Datos financieros actualizados y re-encriptados correctamente.',
      };
    } catch (error) {
      throw new InternalServerErrorException({
        title: 'Error de Actualización Financiera',
        detail: error instanceof Error ? error.message : 'Fallo interno al actualizar los datos financieros.',
      });
    }
  }
}