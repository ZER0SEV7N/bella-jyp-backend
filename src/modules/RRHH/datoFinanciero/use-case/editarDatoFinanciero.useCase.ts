//src/modules/RRHH/datoFinanciero/use-case/editarDatoFinanciero.useCase.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import * as argon2 from 'argon2';
import type { ActualizarDatoFinancieroDto } from '@jyp/shared-contracts';
import {
  validarEntidadesFinancieras,
  validarSueldoCargo,
} from './helper/validacionesDatoFinanciero.helper';
import { sanitizarTexto } from '@/common/utils/transformacion.util';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { ControlIntentosService } from '@/common/guards/control-intentos.service';

/**
 * Caso de uso para editar los datos financieros de un empleado.
 * Aplica Step-Up Authentication (re-confimación de identidad) para operaciones sensibles.
 * y re-encriptacion simetrico AES-256-CGM de campos bancarios antes de almacenarlos en la base de datos.
 */
@Injectable()
export class EditarDatoFinancieroUseCase {
  constructor(
  private readonly prisma: PrismaService,
  @Optional() private readonly controlIntentos?: ControlIntentosService,
) {}

  /**
   * Ejecuta el caso de uso para editar los datos financieros de un empleado (COM-F3).
   * @param idEmpleado - El ID del empleado.
   * @param dto - Los datos a actualizar.
   * @param idUsuario - El ID del usuario autenticado.
   * @returns Una promesa que se resuelve con los datos actualizados.
   * @throws {NotFoundException} Si el dato financiero o el empleado/cargo no existen.
   * @throws {UnauthorizedException} Si el usuario o la contraseña de confirmación son inválidos.
   * @throws {BadRequestException} Si el sueldo básico o los datos previsionales son inválidos.
   * @throws {InternalServerErrorException} Si ocurre un error inesperado durante la actualización.
   */
  async execute(
    idEmpleado: string,
    dto: ActualizarDatoFinancieroDto,
    idUsuario: string
  ) {
    const datoFinanciero = await this.prisma.dato_financiero.findUnique({
      where: { empleado_id: idEmpleado },
    });
    if (datoFinanciero?.deleted_at !== null)
      throw new NotFoundException(
        'El dato financiero del colaborador no existe o ha sido desactivado.'
      );

    //Step-Up Authentication: validación de credenciales para mutaciones sensibles
    const usuarioActual = await this.prisma.usuarios.findUnique({
      where: { id: idUsuario, deleted_at: null },
      select: { password_hash: true },
    });

    if (!usuarioActual)
      throw new UnauthorizedException('Usuario no autorizado.');

    //Control de intentos de confirmación para prevenir ataques de fuerza bruta
    await this.controlIntentos?.verificarDisponible('dato-financiero:confirmar', idUsuario);

    //Validar la contraseña proporcionada para confirmar la identidad del usuario antes de permitir la actualización
    const passwordValida = await argon2.verify(
      usuarioActual.password_hash,
      dto.password_confirmacion,
    );

    // Si la contraseña es incorrecta, registrar el intento fallido y lanzar una excepción
    if (!passwordValida) {
      await this.controlIntentos?.registrarIntento('dato-financiero:confirmar', idUsuario);
      throw new UnauthorizedException({
        title: 'Confirmación de Seguridad Fallida',
        detail: 'La contraseña ingresada es incorrecta. Operación financiera denegada.',
      });
    }

    // Si la contraseña es correcta, limpiar los intentos fallidos para este usuario y acción
    await this.controlIntentos?.limpiarIntentos('dato-financiero:confirmar', idUsuario);

    //Validar entidades foráneas enviadas en la actualización
    await validarEntidadesFinancieras(this.prisma, dto);
    const {
      id_tipo_afp = datoFinanciero.id_tipo_afp,
      cuspp = datoFinanciero.cuspp,
      tipo_comision = datoFinanciero.tipo_comision,
    } = dto;

    // Validar cambios en régimen de pensión y AFP, asegurando consistencia y completitud de datos
    await this.validarCambioPension(idEmpleado, {
      id_regimen: dto.id_regimen ?? datoFinanciero.id_regimen,
      id_tipo_afp,
      cuspp,
      tipo_comision,
    });

    // Validar sueldo básico si se proporciona un nuevo valor
    if (dto.sueldo_basico !== undefined) {
      const cargoEmpleado = await this.prisma.empleados.findUnique({
        where: { id: idEmpleado },
        select: {
          cargo_id: true,
        },
      });

      // Validar que el empleado tenga un cargo asignado antes de validar el sueldo
      if (!cargoEmpleado?.cargo_id) {
        throw new NotFoundException({
          title: 'Empleado o cargo no encontrado',
          detail:
            'No se encontró el colaborador o no cuenta con un cargo asignado.',
        });
      }

      // Validar que el sueldo básico esté dentro del rango permitido para el cargo del empleado
      await validarSueldoCargo(
        this.prisma,
        cargoEmpleado.cargo_id,
        dto.sueldo_basico
      );
    }

    // Encriptar campos bancarios y CUSPP antes de actualizar en la base de datos
    const cusppSanitizado = sanitizarTexto(dto.cuspp);

    // Intentar actualizar los datos financieros del empleado, aplicando encriptación simétrica para los campos bancarios
    const actualizado = await this.prisma.dato_financiero.update({
      where: { empleado_id: idEmpleado },
      data: {
        id_regimen: dto.id_regimen,
        id_tipo_afp: dto.id_tipo_afp,
        sueldo_basico: dto.sueldo_basico,
        //Cifrar CUSPP igual que cuentas bancarias y CCI
        cuspp: CryptoUtil.encryptOptional(cusppSanitizado),
        tipo_comision: sanitizarTexto(dto.tipo_comision),

        // Sueldo (encriptación limpia sin ternarios anidados)
        id_banco_sueldo: dto.id_banco_sueldo,
        tipo_cuenta_sueldo: dto.tipo_cuenta_sueldo,
        nro_cuenta_sueldo: CryptoUtil.encryptOptional(dto.nro_cuenta_sueldo),
        cci_sueldo: CryptoUtil.encryptOptional(dto.cci_sueldo),

        // CTS
        id_banco_cts: dto.id_banco_cts,
        tipo_cuenta_cts: dto.tipo_cuenta_cts,
        nro_cuenta_cts: CryptoUtil.encryptOptional(dto.nro_cuenta_cts),
        cci_cts: CryptoUtil.encryptOptional(dto.cci_cts),

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
  }

  /**
   * Valida los cambios en el régimen de pensión y AFP, asegurando que los datos requeridos estén completos y sean consistentes.
   * @param idEmpleado - El ID del empleado.
   * @param datos - Los datos financieros a validar.
   * @throws BadRequestException si los datos son inconsistentes o incompletos para el régimen de pensión seleccionado.
   * @throws NotFoundException si el régimen de pensión o AFP no existen.
   * @returns Promise<void> - Una promesa que se resuelve si la validación es exitosa, o se rechaza con una excepción si hay errores.
   */
  private async validarCambioPension(
    idEmpleado: string,
    datos: {
      id_regimen: string;
      id_tipo_afp: string | null;
      cuspp: string | null;
      tipo_comision: string | null;
    }
  ): Promise<void> {
    //Validar existencia de régimen, AFP y empleado de forma concurrente
    const [regimen, afp, empleado] = await Promise.all([
      //Validar régimen de pensión
      this.prisma.regimen_pension.findUnique({
        where: { id: datos.id_regimen },
      }),
      //Validar tipo de AFP solo si se proporciona
      datos.id_tipo_afp
        ? this.prisma.tipo_afp.findUnique({ where: { id: datos.id_tipo_afp } })
        : null,
      //Validar existencia del empleado y obtener su fecha de afiliación a la AFP
      this.prisma.empleados.findUnique({
        where: { id: idEmpleado },
        select: { afp_fecha_filiacion: true },
      }),
    ]);

    //Validar resultados de las consultas y lanzar excepciones si alguna entidad no existe
    if (!regimen)
      throw new BadRequestException('Régimen pensionario no encontrado.');

    //Validar que si el régimen es AFP, se proporcionen todos los datos requeridos
    if (
      /AFP|SPP/i.test(regimen.nombre) &&
      (!afp ||
        !datos.cuspp ||
        !datos.tipo_comision ||
        !empleado?.afp_fecha_filiacion)
    )
      throw new BadRequestException(
        'Complete administradora, CUSPP, comisión y fecha de afiliación antes de cambiar a AFP.'
      );

    //Validar que la AFP proporcionada corresponda al régimen de pensión seleccionado
    if (afp && afp.id_regimen !== regimen.id)
      throw new BadRequestException(
        'La AFP no corresponde al régimen pensionario.'
      );
  }
}
