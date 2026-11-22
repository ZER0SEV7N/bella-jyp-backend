//test/modules/RRHH/dashboard/helpers/dashboard-fechas.helper.spec.ts
import { UnprocessableEntityException } from '@nestjs/common';
import {
  obtenerSemanaLaboral,
  resolverContextoFechasDashboard,
} from '@/modules/RRHH/dashboard/helpers/dashboard-fechas.helper';

describe('dashboard-fechas.helper', () => {
  describe('resolverContextoFechasDashboard', () => {
    // 2026-11-22 15:00 UTC => 2026-11-22 10:00 en Lima
    const ahora = new Date('2026-11-22T15:00:00.000Z');

    it('usa el mes actual y hoy en Lima cuando no se envía periodo o coincide con el actual', () => {
      const sinPeriodo = resolverContextoFechasDashboard(undefined, ahora);
      expect(sinPeriodo.periodo).toBe('2026-11');
      expect(sinPeriodo.esMesActual).toBe(true);
      expect(sinPeriodo.fechaCorte).toBe('2026-11-22');
      expect(sinPeriodo.periodoAnterior).toBe('2026-10');
      expect(sinPeriodo.ultimoDiaMesAnterior).toBe('2026-10-31');

      const mesActual = resolverContextoFechasDashboard('2026-11', ahora);
      expect(mesActual.esMesActual).toBe(true);
      expect(mesActual.fechaCorte).toBe('2026-11-22');
    });

    it('usa el último día del mes cuando el periodo es pasado', () => {
      const pasado = resolverContextoFechasDashboard('2026-02', ahora);
      expect(pasado.periodo).toBe('2026-02');
      expect(pasado.esMesActual).toBe(false);
      expect(pasado.fechaCorte).toBe('2026-02-28');
      expect(pasado.periodoAnterior).toBe('2026-01');

      const bisiesto = resolverContextoFechasDashboard('2024-02', ahora);
      expect(bisiesto.esMesActual).toBe(false);
      expect(bisiesto.fechaCorte).toBe('2024-02-29');

      const enero = resolverContextoFechasDashboard('2026-01', ahora);
      expect(enero.periodoAnterior).toBe('2025-12');
      expect(enero.ultimoDiaMesAnterior).toBe('2025-12-31');
    });

    it('lanza 422 con título, detalle y campo cuando el periodo es futuro', () => {
      expect(() => resolverContextoFechasDashboard('2026-12', ahora)).toThrow(
        UnprocessableEntityException
      );

      try {
        resolverContextoFechasDashboard('2026-12', ahora);
      } catch (error) {
        expect((error as UnprocessableEntityException).getResponse()).toEqual({
          title: 'Periodo no disponible',
          detail: 'No se puede consultar un mes futuro.',
          campo: 'periodo',
        });
      }
    });
  });

  describe('obtenerSemanaLaboral', () => {
    it('incluye solo días hasta la fecha de corte cuando cae entre lunes y viernes', () => {
      const semana = obtenerSemanaLaboral('2026-11-18');
      expect(semana).toEqual({
        desde: '2026-11-16',
        hasta: '2026-11-20',
        fechasVisibles: ['2026-11-16', '2026-11-17', '2026-11-18'],
        periodos: ['2026-11'],
      });
    });

    it('devuelve la semana completa lunes-viernes cuando la fecha de corte cae sábado o domingo', () => {
      const sabado = obtenerSemanaLaboral('2026-11-21');
      expect(sabado).toEqual({
        desde: '2026-11-16',
        hasta: '2026-11-20',
        fechasVisibles: [
          '2026-11-16',
          '2026-11-17',
          '2026-11-18',
          '2026-11-19',
          '2026-11-20',
        ],
        periodos: ['2026-11'],
      });

      const domingo = obtenerSemanaLaboral('2026-11-22');
      expect(domingo).toEqual(sabado);
    });

    it('detecta cruce de mes dentro de la misma semana laboral', () => {
      const cruce = obtenerSemanaLaboral('2026-10-02');
      expect(cruce).toEqual({
        desde: '2026-09-28',
        hasta: '2026-10-02',
        fechasVisibles: [
          '2026-09-28',
          '2026-09-29',
          '2026-09-30',
          '2026-10-01',
          '2026-10-02',
        ],
        periodos: ['2026-09', '2026-10'],
      });

      const domingoInicioMes = obtenerSemanaLaboral('2026-11-01');
      expect(domingoInicioMes).toEqual({
        desde: '2026-10-26',
        hasta: '2026-10-30',
        fechasVisibles: [
          '2026-10-26',
          '2026-10-27',
          '2026-10-28',
          '2026-10-29',
          '2026-10-30',
        ],
        periodos: ['2026-10'],
      });
    });
  });
});
