//test/modules/payroll/planillas/use-case/descargarBoleta.useCase.spec.ts
import { ConflictException } from '@nestjs/common';
import { DescargarBoletaUseCase } from '@/modules/payroll/planillas/use-case/descargarBoleta.useCase';

/**
 * Pruebas unitarias para DescargarBoletaUseCase siguiendo el patrón AAA (Arrange, Act, Assert).
 */
describe('DescargarBoletaUseCase', () => {
  const obtener = { execute: jest.fn() };
  const caso = new DescargarBoletaUseCase(obtener as never);

  beforeEach(() => jest.clearAllMocks());

  it('genera y entrega el PDF de la boleta cuando la planilla está CONGELADO con su snapshot completo', async () => {
    // Arrange: planilla validada con instantánea completa de empresa, cabecera y resultado.
    obtener.execute.mockResolvedValue({
      id: 'planilla-1',
      periodo: '2026-09',
      estado: 'CONGELADO',
      snapshot_calculo: {
        empresa: { nombreEmpresa: 'J&P PERIFERICOS SAC', ruc: '20545122520', direccion: 'Lima' },
        cabecera: {
          nombre_completo: 'DEMO CONTADOR',
          nro_documento: '90000002',
          cargo: 'Analista',
          area: 'Oficina',
          asignacion_familiar: true,
          dias_laborados: 30,
          regimen_pension: 'ONP',
        },
        resultado: {
          sueldo_base: '3000.00',
          asignacion_familia: '113.00',
          horas_extras_25: '0.00',
          horas_extras_35: '0.00',
          recargo_nocturno: '0.00',
          gratificacion: '0.00',
          bonif_extraordinaria: '0.00',
          descuento_faltas: '0.00',
          descuento_tardanzas: '0.00',
          descuento_quinta: '0.00',
          descuento_adelanto: '0.00',
          descuento_eps: '0.00',
          descuento_onp: '404.69',
          descuento_afp_fondo: '0.00',
          descuento_afp_seguro: '0.00',
          descuento_afp_comision: '0.00',
          tasa_afp_aplicada: null,
          aporte_essalud: '280.17',
          aporte_vida_ley: '16.50',
          total_ingresos: '3113.00',
          total_descuentos: '404.69',
          neto_a_pagar: '2708.31',
        },
      },
    });

    // Act
    const r = await caso.execute('planilla-1');

    // Assert
    expect(r.nombre).toBe('boleta-2026-09-planilla-1.pdf');
    expect(r.stream).toBeDefined();
    r.stream.destroy();
  });

  it('no genera una boleta definitiva desde un borrador ABIERTO', async () => {
    // Arrange
    obtener.execute.mockResolvedValue({
      id: 'planilla-1',
      estado: 'ABIERTO',
      snapshot_calculo: {},
    });

    // Act
    const r = caso.execute('planilla-1');

    // Assert
    await expect(r).rejects.toThrow('validada');
  });

  it('lanza ConflictException si la instantánea está incompleta', async () => {
    // Arrange
    obtener.execute.mockResolvedValue({
      id: 'planilla-1',
      estado: 'CONGELADO',
      snapshot_calculo: { empresa: null },
    });

    // Act & Assert
    await expect(caso.execute('planilla-1')).rejects.toThrow(ConflictException);
  });
});
