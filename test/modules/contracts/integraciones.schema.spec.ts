import {
    ResultadoIntegracionSchema,
    ConfiguracionExportacionSchema,
} from '@jyp/shared-contracts';
describe('Manifiesto del ejecutor n8n', () => {
    it('No declara éxito cuando no hay archivos ni un error explicado', () => {
        // Arrange: callback vacío, sin evidencia de trabajo realizado.
        const datos = { archivos: [], correos: [] };
        // Act: validar en el contrato compartido con el controlador.
        const r = ResultadoIntegracionSchema.safeParse(datos);
        // Assert: el error se informa antes de persistir COMPLETADO.
        expect(r.success).toBe(false);
    });
    it('Permite comunicar un fallo sin documentos parciales', () => {
        // Arrange: n8n detectó un dato faltante antes de escribir archivos.
        const datos = {
            archivos: [],
            correos: [],
            error: 'Falta clasificación del bono.',
        };
        // Act: validar el resultado de fallo.
        const r = ResultadoIntegracionSchema.safeParse(datos);
        // Assert: la ausencia de archivos no oculta un error explícito.
        expect(r.success).toBe(true);
    });
});

describe('Clasificación contable PLAME', () => {
    it('No permite sumar totales al sueldo usando un código de concepto', () => {
        // Arrange: un total del motor no constituye un ingreso adicional.
        const datos = { conceptos_plame: { neto_a_pagar: '0121' } };
        // Act: validar la configuración antes de enviarla a n8n.
        const r = ConfiguracionExportacionSchema.safeParse(datos);
        // Assert: se evita duplicar montos mezclando totales y conceptos individuales.
        expect(r.success).toBe(false);
    });
});
