//src/modules/payroll/datoFinanciero/use-case/obtenerDatoFinanciero.useCase
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CryptoUtil } from '@/common/utils/crypto.util';

/**
 * Caso de uso para consultar los datos financieros de un empleado.
 * Debe desencriptar los datos temporalmente en memoria y entregar los datos con enmascaramiento dinamico
 * Con el fin de proteger la informacion del empleado
 */
@Injectable()
export class ObtenerDatoFinancieroUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 
   */
  async execute(idEmpleado: string) {
    const datoFinanciero = await this.prisma.dato_financiero.findUnique({
      where: { empleado_id: idEmpleado},
      include: {
        bancos: { select: {nombre: true }},
        regimen_pension: {select: {nombre: true }},
        tipo_afp: { select: {nombre: true}}
      }
    });

    if(!datoFinanciero || datoFinanciero.deleted_at !== null ) throw new NotFoundException("No se encontraron datos financieros registrados para el empleado.");

    //Retornar objeto formateado con enmascaramiento de los campos sensibles
    return {
      id: datoFinanciero.id,
      empleado_id: datoFinanciero.empleado_id,
      id_regimen: datoFinanciero.id_regimen,
      regimen_nombre: datoFinanciero.regimen_pension?.nombre || null,
      id_tipo_afp: datoFinanciero.id_tipo_afp,
      afp_nombre: datoFinanciero.tipo_afp?.nombre || null,
      id_banco: datoFinanciero.id_banco,
      banco_nombre: datoFinanciero.bancos?.nombre || null,

      //Enmascaramiento
      cuenta_bancaria: CryptoUtil.mask(datoFinanciero.cuenta_bancaria, 4),
      cci: CryptoUtil.mask(datoFinanciero.cci, 4),
      nro_cuenta_cts: CryptoUtil.mask(datoFinanciero.nro_cuenta_cts, 4),

      sueldo_basico: Number(datoFinanciero.sueldo_basico),
      cuspp: CryptoUtil.mask(datoFinanciero.cuspp, 4),
      tipo_comision: datoFinanciero.tipo_comision
    };
  }
}