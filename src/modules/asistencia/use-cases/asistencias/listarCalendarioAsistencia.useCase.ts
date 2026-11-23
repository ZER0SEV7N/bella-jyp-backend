//src/modules/asistencia/use-cases/asistencias/listarCalendarioAsistencia.useCase.ts
import { PrismaService } from '@/common/prisma/prisma.service';
import { ServerTime } from '@/common/utils/server-time';
import type {
  CalendarioAsistenciaRespuesta,
  DiaCalendarioAsistencia,
} from '@jyp/shared-contracts';
import { Injectable } from '@nestjs/common';
import { feriadosNacionalesPeru } from '../../domain/calendario-peru';
import { listarPeriodosCerrados } from '../../helpers/periodo-editable.helper';

/**
 * Caso de uso para listar el calendario anual de asistencia (ASI-M5).
 * Combina los feriados nacionales calculados por el motor con los descansos adicionales registrados en la base de datos
 * e indica qué meses del año se encuentran cerrados para cambios globales.
 */
@Injectable()
export class ListarCalendarioAsistenciaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista los días no laborables del calendario de asistencia para un año específico.
   *
   * @param anio - Año civil a consultar (entre 1992 y 9998).
   * @returns Respuesta con el año consultado, los períodos cerrados y el detalle ordenado de días.
   * @throws {RangeError} Si el año está fuera del rango admitido por el motor de feriados.
   */
  async execute(anio: number): Promise<CalendarioAsistenciaRespuesta> {
    const nacionales = feriadosNacionalesPeru(anio);
    const inicioAnio = ServerTime.desdeFechaSimple(`${anio}-01-01`);
    const finAnio = ServerTime.desdeFechaSimple(`${anio}-12-31`);
    const periodosAnio = Array.from(
      { length: 12 },
      (_, indice) => `${anio}-${String(indice + 1).padStart(2, '0')}`
    );

    const [adicionales, mesesCerrados] = await Promise.all([
      this.prisma.asistencia_calendario.findMany({
        where: { fecha: { gte: inicioAnio, lte: finAnio } },
        orderBy: { fecha: 'asc' },
      }),
      listarPeriodosCerrados(this.prisma, periodosAnio),
    ]);

    const cerradosSet = new Set(mesesCerrados);

    const diasNacionales: DiaCalendarioAsistencia[] = nacionales.map(
      (feriado) => ({
        fecha: feriado.fecha,
        nombre: feriado.nombre,
        origen: 'NACIONAL',
        id: null,
        motivo: null,
        activo: true,
        periodo_cerrado: cerradosSet.has(feriado.fecha.slice(0, 7)),
        actualizado_en: null,
      })
    );

    const diasAdicionales: DiaCalendarioAsistencia[] = adicionales.map(
      (fila) => {
        // Se lee la fecha civil UTC directamente para evitar desplazamientos por zona horaria local.
        const fecha = fila.fecha.toISOString().slice(0, 10);
        return {
          fecha,
          nombre: fila.nombre,
          origen: 'ADICIONAL',
          id: fila.id,
          motivo: fila.motivo,
          activo: fila.activo,
          periodo_cerrado: cerradosSet.has(fecha.slice(0, 7)),
          actualizado_en: fila.updated_at.toISOString(),
        };
      }
    );

    const dias = [...diasNacionales, ...diasAdicionales].sort((a, b) => {
      const comparacion = a.fecha.localeCompare(b.fecha);
      if (comparacion !== 0) return comparacion;
      if (a.origen === b.origen) return 0;
      return a.origen === 'NACIONAL' ? -1 : 1;
    });

    return {
      anio,
      meses_cerrados: mesesCerrados,
      dias,
    };
  }
}
