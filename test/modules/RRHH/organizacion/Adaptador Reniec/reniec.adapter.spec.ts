//test/modules/RRHH/organizacion/Adaptador Reniec/reniec.Adapter.spec.ts
import { ReniecAdapter } from '@/modules/RRHH/organizacion/services/reniec.adapter';
import { BadGatewayException, RequestTimeoutException } from '@nestjs/common';

/**
 * Pruebas unitarias para el ReniecAdapter, que interactúa con la API de RENIEC.
 * Estas pruebas verifican el comportamiento del adaptador en escenarios de éxito y error.
 * Se simula la respuesta de la API de RENIEC utilizando mocks para evitar llamadas reales.
 * Se valida que los nombres y apellidos se formateen correctamente a Title Case.
 * También se prueban los casos de error, incluyendo respuestas HTTP no exitosas y timeouts.
 */
describe('ReniecAdapter - Pruebas Unitarias de Integración Externa', () => {
    let adapter: ReniecAdapter;
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        process.env.RENIEC_API_URL = 'https://api.reniec.gob.pe';
        process.env.RENIEC_API_KEY = 'test_token_2026';

        adapter = new ReniecAdapter();
        (global as any).fetch = jest.fn();
    });

    afterAll(() => process.env = ORIGINAL_ENV);

    describe('consultarDni() - Formateo Title Case y Petición HTTP', () => {
        it('Debe consultar RENIEC y retornar los nombres y apellidos formateados en Title Case', async () => {
            const mockDni = '12345678';
            const mockReniecResponse = {
                dni: '12345678',
                nombres: 'ADRIAN MATIAS',
                codVerifica: 2,
                apellidoPaterno: 'DUEÑAS',
                apellidoMaterno: 'HUERTAS'
            };

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue(mockReniecResponse)
            });

            const resultado = await adapter.consultarDni(mockDni);

            expect(global.fetch).toHaveBeenCalledWith('https://api.reniec.gob.pe/dni/12345678?token=test_token_2026',
                expect.objectContaining({
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                })
            );

            // Verificación de Title Case
            expect(resultado).toEqual({
                nombre: 'Adrian Matias',
                apellido_paterno: 'Dueñas',
                apellido_materno: 'Huertas',
            });
        });

        it('Debe lanzar un error si el número de documento es inválido o no existe en RENIEC', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 404,
                json: jest.fn().mockResolvedValue({ message: 'DNI no encontrado' })
            });

            await expect(adapter.consultarDni('00000000')).rejects.toThrow(BadGatewayException);
        });

        it('Debe lanzar BadGatewayException si la API de RENIEC responde con status de error HTTP', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 502 });

            await expect(adapter.consultarDni('60747019')).rejects.toThrow(BadGatewayException);
        });

        it('Debe lanzar RequestTimeoutException si la petición se cancela por AbortError (Timeout 5s)', async () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';

            (global.fetch as jest.Mock).mockRejectedValue(abortError);

            await expect(adapter.consultarDni('60747019')).rejects.toThrow(new RequestTimeoutException('Timeout: La API de RENIEC tardó demasiado en responder.'));
        });
    });
});