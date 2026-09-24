//test/common/config/env.validation.spec.ts
import { validateEnv } from '@/common/config/env.validation';

/**
 * Pruebas unitarias para la validación de variables de entorno.
 * Se asegura de que las variables de entorno requeridas estén presentes y cumplan con los criterios de seguridad.
 * También verifica que las variables opcionales se generen correctamente si no se proporcionan.
 * Se incluyen casos de prueba para escenarios felices y excepciones.
 */
describe('EnvValidation - Pruebas Unitarias de Variables de Entorno', () => {
    //Configuración base válida para pruebas
    const validConfig = {
        NODE_ENV: 'test',
        PORT: '3000',
        DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/db_test',
        JWT_ACCESS_SECRET: 'super_secret_access_key_minimum_32_bytes_2026',
        JWT_REFRESH_SECRET: 'super_secret_refresh_key_minimum_32_bytes_2026'
    };

    beforeEach(() => {
        //Mock para console.error para evitar que los errores se impriman en la consola durante las pruebas
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('Debe validar configuración base y generar valores dinámicos opcionales', () => {
        const result = validateEnv(validConfig);

        expect(result.NODE_ENV).toBe('test');
        expect(result.DATABASE_URL).toBe(validConfig.DATABASE_URL);
        expect(result.RENIEC_API_URL).toBeUndefined();
        expect(result.FINANCIAL_DATA_ENCRYPTION_KEY).toBeDefined();
        expect(result.FINANCIAL_DATA_ENCRYPTION_KEY.length).toBeGreaterThanOrEqual(32);
    });

    it('Debe lanzar un error si falta una variable estrictamente requerida como JWT_ACCESS_SECRET', () => {
        const invalidConfig = { ...validConfig, JWT_ACCESS_SECRET: undefined };

        expect(() => validateEnv(invalidConfig as any)).toThrow('Variables de entorno inválidas');
    });

    it('Debe rechazar llaves JWT_ACCESS_SECRET de menos de 32 caracteres por seguridad', () => {
        const invalidConfig = { ...validConfig, JWT_ACCESS_SECRET: 'clave_corta_123' };

        expect(() => validateEnv(invalidConfig)).toThrow('Variables de entorno inválidas');
    });

    it('Debe rechazar NODE_ENV con valores fuera del enumerado permitido', () => {
        const invalidConfig = { ...validConfig, NODE_ENV: 'invalid_env' };

        expect(() => validateEnv(invalidConfig)).toThrow('Variables de entorno inválidas');
    });
});