import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

// Contratos próximos a expirar (dentro de los próximos 30 días)
@Injectable()
export class Contratos_Expirar {
  private readonly DIAS_ANTICIPACION = 30;

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<number> {
    const fecha_hoy = this.normalizeToDateOnly(new Date());
    const fecha_limite = this.addDays(fecha_hoy, this.DIAS_ANTICIPACION);

    const cantidad = await this.prisma.contratos.count({
      where: {
        fecha_fin: {
          gte: fecha_hoy,
          lte: fecha_limite,
        },
      },
    });

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
