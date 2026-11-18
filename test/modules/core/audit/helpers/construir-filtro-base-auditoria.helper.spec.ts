//test/modules/core/audit/helpers/construir-filtro-base-auditoria.helper.spec.ts
import { construirFiltroBase } from '@/modules/core/audit/helpers/construir-filtro-base-auditoria.helper';

const ADMIN = { id: 'u1', rol: 'ADMIN' };

describe('construirFiltroBase - rango de fechas', () => {
  it('Debe mantener los límites en UTC por defecto, como usa /logs', () => {
    // Arrange y Act
    const where = construirFiltroBase(ADMIN, {
      desde: '2026-11-01',
      hasta: '2026-11-30',
    });

    // Assert
    expect(where.created_at).toEqual({
      gte: new Date('2026-11-01'),
      lte: new Date('2026-11-30T23:59:59.999Z'),
    });
  });

  it('Debe interpretar desde y hasta como días de Lima cuando se pide', () => {
    // Arrange y Act
    const where = construirFiltroBase(
      ADMIN,
      { desde: '2026-11-01', hasta: '2026-11-30' },
      { diasEnHoraLima: true }
    );

    // Assert
    expect(where.created_at).toEqual({
      gte: new Date('2026-11-01T05:00:00.000Z'),
      lt: new Date('2026-12-01T05:00:00.000Z'),
    });
  });

  it('Debe cruzar bien el fin de año y los meses bisiestos con hasta en hora de Lima', () => {
    // Arrange y Act
    const finDeAnio = construirFiltroBase(
      ADMIN,
      { hasta: '2026-12-31' },
      { diasEnHoraLima: true }
    );
    const bisiesto = construirFiltroBase(
      ADMIN,
      { hasta: '2028-02-28' },
      { diasEnHoraLima: true }
    );

    // Assert
    expect(finDeAnio.created_at).toEqual({
      lt: new Date('2027-01-01T05:00:00.000Z'),
    });
    expect(bisiesto.created_at).toEqual({
      lt: new Date('2028-02-29T05:00:00.000Z'),
    });
  });

  it('Debe aceptar un solo extremo y no agregar created_at sin fechas', () => {
    // Arrange y Act
    const soloDesde = construirFiltroBase(
      ADMIN,
      { desde: '2026-11-01' },
      { diasEnHoraLima: true }
    );
    const sinFechas = construirFiltroBase(ADMIN, {}, { diasEnHoraLima: true });

    // Assert
    expect(soloDesde.created_at).toEqual({
      gte: new Date('2026-11-01T05:00:00.000Z'),
    });
    expect(sinFechas).toEqual({});
  });
});
