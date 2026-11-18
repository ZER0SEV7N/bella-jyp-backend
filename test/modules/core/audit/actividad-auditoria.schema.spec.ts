//test/modules/core/audit/actividad-auditoria.schema.spec.ts
import {
  ActividadAuditoriaQuerySchema,
  AfectadoParamsSchema,
  LineaTiempoAfectadoQuerySchema,
} from '@/modules/core/audit/contracts/actividad-auditoria.schema';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { BadRequestException } from '@nestjs/common';

const UUID = '0192a000-0000-7000-8000-000000000001';

describe('ActividadAuditoriaQuerySchema', () => {
  it('Debe aplicar page=1 y limit=50 por defecto y conservar desde y hasta', () => {
    // Arrange y Act
    const resultado = ActividadAuditoriaQuerySchema.parse({
      desde: '2026-11-01',
      hasta: '2026-11-30',
    });

    // Assert
    expect(resultado).toMatchObject({
      page: 1,
      limit: 50,
      desde: '2026-11-01',
      hasta: '2026-11-30',
    });
  });

  it('Debe aceptar los filtros de afectado', () => {
    // Arrange y Act
    const resultado = ActividadAuditoriaQuerySchema.parse({
      afectado_tipo: 'empleado',
      afectado_id: UUID,
      page: '2',
      limit: '10',
    });

    // Assert
    expect(resultado).toMatchObject({
      afectado_tipo: 'empleado',
      afectado_id: UUID,
      page: 2,
      limit: 10,
    });
  });

  it.each([
    '2026-02-31',
    '2026-13-01',
    '01/11/2026',
    'ayer',
    '2026-11-01T10:00:00Z',
  ])('Debe rechazar la fecha inválida %s', (desde) => {
    // Arrange y Act
    const resultado = ActividadAuditoriaQuerySchema.safeParse({ desde });

    // Assert
    expect(resultado.success).toBe(false);
  });

  it('Debe rechazar un rango con desde posterior a hasta', () => {
    // Arrange y Act
    const resultado = ActividadAuditoriaQuerySchema.safeParse({
      desde: '2026-11-30',
      hasta: '2026-11-01',
    });

    // Assert
    expect(resultado.success).toBe(false);
  });

  it('Debe rechazar un tipo de afectado desconocido, un afectado_id que no es UUID y un limit mayor a 100', () => {
    // Arrange y Act y Assert
    expect(
      ActividadAuditoriaQuerySchema.safeParse({ afectado_tipo: 'planeta' })
        .success
    ).toBe(false);
    expect(
      ActividadAuditoriaQuerySchema.safeParse({ afectado_id: '123' }).success
    ).toBe(false);
    expect(
      ActividadAuditoriaQuerySchema.safeParse({ limit: '101' }).success
    ).toBe(false);
  });
});

describe('Parámetros de ruta de la línea de tiempo', () => {
  it('Debe aceptar un tipo con ID y rechazar la empresa o un ID inválido', () => {
    // Arrange y Act y Assert
    expect(
      AfectadoParamsSchema.safeParse({ tipo: 'cargo', id: UUID }).success
    ).toBe(true);
    expect(
      AfectadoParamsSchema.safeParse({ tipo: 'empresa', id: UUID }).success
    ).toBe(false);
    expect(
      AfectadoParamsSchema.safeParse({ tipo: 'empleado', id: 'abc' }).success
    ).toBe(false);
  });

  it('Debe usar 20 filas por defecto en la línea de tiempo', () => {
    // Arrange y Act
    const resultado = LineaTiempoAfectadoQuerySchema.parse({});

    // Assert
    expect(resultado).toMatchObject({ page: 1, limit: 20 });
  });

  it('ZodValidationPipe debe validar @Param() solo si se activa la validación de ruta', () => {
    // Arrange
    const pipeNormal = new ZodValidationPipe(AfectadoParamsSchema);
    const pipeRuta = new ZodValidationPipe(AfectadoParamsSchema, false, true);
    const invalido = { tipo: 'planeta', id: 'abc' };

    // Act y Assert
    expect(pipeNormal.transform(invalido, { type: 'param' })).toBe(invalido);
    expect(() => pipeRuta.transform(invalido, { type: 'param' })).toThrow(
      BadRequestException
    );
    expect(
      pipeRuta.transform({ tipo: 'area', id: UUID }, { type: 'param' })
    ).toEqual({ tipo: 'area', id: UUID });
  });
});
