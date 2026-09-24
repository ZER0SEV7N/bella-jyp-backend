//src/modules/payroll/datoFinanciero/use-case/agregarDatoFinanciero.useCase.ts
import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CrearDatoFinancieroDto } from '@jyp/shared-contracts';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { IdentityGenerator } from '@/common/utils/uuid.util';
import { sanitizarTexto } from '@/common/utils/transformacion.util';


/**
 * Caso de uso para registar los datos financieros de un empleado.
 * Encripta los datos sensibles antes de almacenarlos en la base de datos.
 * Valida la existencia y estado del empleado, banco y régimen de pensión.
 * Retorna el registro creado o lanza excepciones en caso de errores.
 */
@Injectable()
export class AgregarDatoFinancieroUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el caso de uso para agregar datos financieros de un empleado.
   * @param dto Objeto que contiene los datos financieros a registrar.
   * @returns El registro de datos financieros creado.
   * @throws NotFoundException si el empleado, banco o régimen no existen o no son válidos.
   * @throws InternalServerErrorException si ocurre un error al intentar crear el registro.
   */
  async execute(dto: CrearDatoFinancieroDto) {
    //Validar existencia de empleado
    const empleado = await this.prisma.empleados.findUnique({where: { id: dto.empleado_id, deleted_at: null }});

    if (!empleado) throw new NotFoundException({
      title: 'Empleado no encontrado',
      detail: 'El colaborador no existe o ha sido dado de baja.',
    });
  

    // 2. Validar que no exista dato financiero duplicado
    const datoExistente = await this.prisma.dato_financiero.findFirst({ where: { empleado_id: dto.empleado_id, deleted_at: null } });

    if (datoExistente) throw new ConflictException({
      title: 'Dato Financiero Existente',
      detail: 'El empleado ya cuenta con una ficha financiera activa.',
    });
    

    // 3. Validar entidades foráneas de previsión y bancarias
    const [regimen, tipoAfp, bancoSueldo, bancoCts] = await Promise.all([
      this.prisma.regimen_pension.findUnique({ where: { id: dto.id_regimen } }),
      dto.id_tipo_afp ? this.prisma.tipo_afp.findUnique({ where: { id: dto.id_tipo_afp } }) : null,
      dto.id_banco_sueldo ? this.prisma.bancos.findUnique({ where: { id: dto.id_banco_sueldo } }) : null,
      dto.id_banco_cts ? this.prisma.bancos.findUnique({ where: { id: dto.id_banco_cts } }) : null,
    ]);

    if (!regimen) throw new NotFoundException('El régimen de pensión especificado no existe.');
    if (dto.id_tipo_afp && !tipoAfp) throw new NotFoundException('El tipo de AFP especificado no existe.');
    if (dto.id_banco_sueldo && !bancoSueldo) throw new NotFoundException('El banco para sueldo no existe.');
    if (dto.id_banco_cts && !bancoCts) throw new NotFoundException('El banco para CTS no existe.');

    try {
      // 4. Encriptación simétrica AES-256-GCM para cuentas y CCIs
      const nroCuentaSueldoEncrypted = dto.nro_cuenta_sueldo ? CryptoUtil.encrypt(dto.nro_cuenta_sueldo.trim()) : null;
      const cciSueldoEncrypted = dto.cci_sueldo ? CryptoUtil.encrypt(dto.cci_sueldo.trim()) : null;
      const nroCuentaCtsEncrypted = dto.nro_cuenta_cts ? CryptoUtil.encrypt(dto.nro_cuenta_cts.trim()) : null;
      const cciCtsEncrypted = dto.cci_cts ? CryptoUtil.encrypt(dto.cci_cts.trim()) : null;

      const nuevoDatoFinanciero = await this.prisma.dato_financiero.create({
        data: {
          id: IdentityGenerator.generateId(),
          empleado_id: dto.empleado_id,
          id_regimen: dto.id_regimen,
          id_tipo_afp: dto.id_tipo_afp ?? null,
          sueldo_basico: dto.sueldo_basico,
          cuspp: sanitizarTexto(dto.cuspp),
          tipo_comision: sanitizarTexto(dto.tipo_comision),

          // Sueldo
          id_banco_sueldo: dto.id_banco_sueldo ?? null,
          tipo_cuenta_sueldo: dto.tipo_cuenta_sueldo,
          nro_cuenta_sueldo: nroCuentaSueldoEncrypted,
          cci_sueldo: cciSueldoEncrypted,

          // CTS
          id_banco_cts: dto.id_banco_cts ?? null,
          tipo_cuenta_cts: dto.tipo_cuenta_cts,
          nro_cuenta_cts: nroCuentaCtsEncrypted,
          cci_cts: cciCtsEncrypted,

          // Régimen de Salud / EPS
          regimen_salud: dto.regimen_salud,
          eps_nombre: sanitizarTexto(dto.eps_nombre),
          eps_plan: sanitizarTexto(dto.eps_plan),
          eps_costo_adicional: dto.eps_costo_adicional ?? 0,
        },
      });

      return {
        id: nuevoDatoFinanciero.id,
        empleado_id: nuevoDatoFinanciero.empleado_id,
        mensaje: 'Datos financieros del colaborador registrados exitosamente.',
      };
    } catch (error) {
      throw new InternalServerErrorException({
        title: 'Error al Registrar Datos Financieros',
        detail: error instanceof Error ? error.message : 'Fallo interno al registrar la información financiera.',
      });
    }
  }
}