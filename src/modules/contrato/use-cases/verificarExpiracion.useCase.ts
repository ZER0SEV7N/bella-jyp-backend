//src/modules/contrato/use-case/verificarExpiracionContratos.useCase.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

/**
 * Caso de uso para contar contratos próximos a expirar en un rango de días.
 * Este caso de uso se utiliza para verificar cuántos contratos están próximos a vencer
 * dentro de un período de anticipación definido (30 días por defecto).
 *
 * @returns {Promise<number>} La cantidad de contratos próximos a expirar.
 */
@Injectable()
export class VerificarExpiracionContratosUseCase {
  private readonly logger = new Logger(VerificarExpiracionContratosUseCase.name); //Logger para registrar eventos y errores relacionados con la verificación de expiración de contratos
  private readonly DIAS_ANTICIPACION = 30; //Numero de dias antes de la fecha de fin del contrato para considerarlo próximo a expirar

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<number> {
    const hoy = new Date();
    const fechaLimite = new Date();
    fechaLimite.setUTCDate(hoy.getUTCDate() + this.DIAS_ANTICIPACION);

    //Realizar la consulta a la base de datos para contar los contratos que expiran entre hoy y la fecha límite
    const cantidad = await this.prisma.contratos.count({
      where: {
        activo: true,
        renovado: false,
        fecha_fin: {
          gte: hoy,
          lte: fechaLimite,
        },
        deleted_at: null,
      }
    });

    //Verificar si se encontraron contratos próximos a expirar y registrar la información en el log
    if (cantidad > 0) this.logger.log(`Se encontraron ${cantidad} contratos próximos a vencer.`);

    return cantidad;
  }

  // Normaliza a medianoche UTC (evita desfaces con columnas @db.Date)
  private normalizeToDateOnly(date: Date): Date {
    return new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }
}
