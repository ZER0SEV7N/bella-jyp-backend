import * as contratos from '@jyp/shared-contracts';

describe('contratos - Reglas aisladas del motor', () => {
    it('El contrato HTTP rechaza una hora sin zona', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        // Act: ejecutar la regla.
        const resultado1 = contratos.marcarAsistenciaSchema.safeParse({
            nro_documento: '00123456',
            fecha_hora: '2026-09-01T09:00:00',
            tipo_marcacion: 'ENTRADA',
            motivo: 'Registro manual justificado',
        }).success;
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toBe(false);
    });

    it('El contrato convierte una hora con zona a un Date', () => {
        // Arrange: preparar únicamente los datos del escenario; los motores son funciones puras.
        // Act: ejecutar la regla.
        const resultado1 = contratos.marcarAsistenciaSchema
            .parse({
                nro_documento: '00123456',
                fecha_hora: '2026-09-01T09:00:00-05:00',
                tipo_marcacion: 'ENTRADA',
                motivo: 'Registro manual justificado',
            })
            .fecha_hora.toISOString();
        // Assert: comprobar el resultado esperado del escenario.
        expect(resultado1).toBe('2026-09-01T14:00:00.000Z');
    });
});
