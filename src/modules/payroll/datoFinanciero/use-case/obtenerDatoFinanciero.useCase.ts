//src/modules/payroll/datoFinanciero/use-case/obtenerDatoFinanciero.useCase
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  Injectable,
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
   * Metodo para obtener los datos financieros de un empleado por su ID.
   * @param idEmpleado - El ID del empleado cuyos datos financieros se desean consultar.
   * @returns Los datos financieros del empleado con enmascaramiento de los campos sensibles.
   * @throws NotFoundException si no se encuentran datos financieros para el empleado especificado.
   */
  async execute(idEmpleado: string) {
    const datoFinanciero = await this.prisma.dato_financiero.findUnique({
      where: { empleado_id: idEmpleado },
      include: {
        regimen_pension: { select: { nombre: true } },
        tipo_afp: { select: { nombre: true } },
        banco_sueldo: { select: { nombre: true } },
        banco_cts: { select: { nombre: true } },
      },
    });

    if (!datoFinanciero || datoFinanciero.deleted_at !== null) {
      throw new NotFoundException({
        title: 'Dato Financiero no Encontrado',
        detail: 'No se encontraron datos financieros registrados para el empleado.',
      });
    }

    return {
      id: datoFinanciero.id,
      empleado_id: datoFinanciero.empleado_id,

      // Régimen Previsional (AFP / ONP)
      id_regimen: datoFinanciero.id_regimen,
      regimen_nombre: datoFinanciero.regimen_pension?.nombre ?? null,
      id_tipo_afp: datoFinanciero.id_tipo_afp,
      afp_nombre: datoFinanciero.tipo_afp?.nombre ?? null,
      cuspp: datoFinanciero.cuspp ? CryptoUtil.mask(datoFinanciero.cuspp, 3) : null,
      tipo_comision: datoFinanciero.tipo_comision,
      sueldo_basico: Number(datoFinanciero.sueldo_basico),

      // Cuenta de Abono de Sueldo
      id_banco_sueldo: datoFinanciero.id_banco_sueldo,
      banco_sueldo_nombre: datoFinanciero.banco_sueldo?.nombre ?? null,
      tipo_cuenta_sueldo: datoFinanciero.tipo_cuenta_sueldo,
      nro_cuenta_sueldo: this.desencriptarYEnmascarar(datoFinanciero.nro_cuenta_sueldo, 4),
      cci_sueldo: this.desencriptarYEnmascarar(datoFinanciero.cci_sueldo, 4),

      // Cuenta de Depósito de CTS
      id_banco_cts: datoFinanciero.id_banco_cts,
      banco_cts_nombre: datoFinanciero.banco_cts?.nombre ?? null,
      tipo_cuenta_cts: datoFinanciero.tipo_cuenta_cts,
      nro_cuenta_cts: this.desencriptarYEnmascarar(datoFinanciero.nro_cuenta_cts, 4),
      cci_cts: this.desencriptarYEnmascarar(datoFinanciero.cci_cts, 4),

      // Aseguramiento de Salud (EsSalud / EPS)
      regimen_salud: datoFinanciero.regimen_salud,
      eps_nombre: datoFinanciero.eps_nombre,
      eps_plan: datoFinanciero.eps_plan,
      eps_costo_adicional: Number(datoFinanciero.eps_costo_adicional),

      created_at: datoFinanciero.created_at,
      updated_at: datoFinanciero.updated_at,
    };
  }

/**
   * Desencripta un valor cifrado en base de datos y le aplica máscara conservando los últimos dígitos.
   */
  private desencriptarYEnmascarar(valorCifrado?: string | null, digitosVisibles = 4): string | null {
    if (!valorCifrado) return null;

    try {
      const textoPlano = CryptoUtil.decrypt(valorCifrado);
      return CryptoUtil.mask(textoPlano, digitosVisibles);
    } catch {
      // Fallback defensivo si el registro antiguo estuviera en texto plano
      return CryptoUtil.mask(valorCifrado, digitosVisibles);
    }
  }
}

