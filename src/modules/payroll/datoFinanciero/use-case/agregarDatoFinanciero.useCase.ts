//src/modules/payroll/datoFinanciero/use-case/agregarDatoFinanciero.useCase.ts
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CrearDatoFinancieroDto } from '@jyp/shared-contracts';
import { CryptoUtil } from '@/common/utils/crypto.util';
import { IdentityGenerator } from '@/common/utils/uuid.util';

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
    //Validar que el empleado exista
    const empleado = await this.prisma.empleados.findUnique({ where: { id: dto.empleado_id , deleted_at: null }});

    if(!empleado) throw new NotFoundException('Empleado no encontrado o ha sido eliminado recientemente.');

    //Validar que no exista un registro de datos financieros para el mismo empleado
    const datoFinancieroExistente = await this.prisma.dato_financiero.findFirst({where: { empleado_id: dto.empleado_id, deleted_at: null }});

    if(datoFinancieroExistente) throw new ConflictException('Ya existe un registro de datos financieros para este empleado. No se puede crear un duplicado.');
    
    //Validar el regimen pensionario
    const regimen = await this.prisma.regimen_pension.findUnique({ where: {id: dto.id_regimen}});

    if(!regimen) throw new NotFoundException('El régimen de pensión especificado no existe.');

    //Validar tipo de AFP si fue proporcionado
    if(dto.id_tipo_afp){
      const tipoAfp = await this.prisma.tipo_afp.findUnique({ where: {id: dto.id_tipo_afp }});

      if(!tipoAfp) throw new NotFoundException('El tipo de AFP especificado no existe.');
    }

    //Validar banco si fue proporcionado
    if(dto.id_banco) {
      const banco = await this.prisma.bancos.findUnique({ where: {id: dto.id_banco }});

      if(!banco) throw new NotFoundException('El banco especificado no existe.');
    }
    
    try {
      //Encriptacion Criptografica AES-256-CGM de campos bancarios
      const cuentaEncrypted = CryptoUtil.encrypt(dto.cuenta_bancaria);
      const cciEncrypted = CryptoUtil.encrypt(dto.cci);
      const ctsEncrypted = CryptoUtil.encrypt(dto.nro_cuenta_cts);

      //Persistencia atomica
      const nuevoDatoFinanciero = await this.prisma.dato_financiero.create({
        data: {
          id: IdentityGenerator.generateId(),
          empleado_id: dto.empleado_id,
          id_regimen: dto.id_regimen,
          id_tipo_afp: dto.id_tipo_afp || null,
          id_banco: dto.id_banco || null,
          cuenta_bancaria: cuentaEncrypted,
          cci: cciEncrypted,
          nro_cuenta_cts: ctsEncrypted,
          sueldo_basico: dto.sueldo_basico,
          cuspp: dto.cuspp || null,
          tipo_comision: dto.tipo_comision || null,
        }
      });

      return {
        id: nuevoDatoFinanciero.id,
        empleado_id: nuevoDatoFinanciero.empleado_id,
        mensaje: 'Datos financieros del empleado registrados exitosamente.'
      };
    } catch (error) {
      throw new InternalServerErrorException('Error al registrar los datos financieros.', error instanceof Error ? error.message : String(error));
    }
  }
}
