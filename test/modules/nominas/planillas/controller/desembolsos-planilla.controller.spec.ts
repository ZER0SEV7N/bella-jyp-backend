import { DesembolsosPlanillaController } from '@/modules/nomina/planillas/controller/desembolsos-planilla.controller';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import 'reflect-metadata';

/** Unitarias del controlador. Los pipes y las guardias HTTP se comprueban en integración. */
describe('DesembolsosPlanillaController', () => {
    const registrarDesembolso = { execute: jest.fn() };
    const controller = new DesembolsosPlanillaController(
        registrarDesembolso as never
    );
    beforeEach(() => jest.clearAllMocks());
    it('desembolsar: conserva los parámetros y el resultado del caso de uso', async () => {
        // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
        const dto = { empleado_id: 'empleado', periodo: '2026-09', version: 1 };
        const req = {
            user: {
                id: '019a0000-0002-7000-8000-000000000003',
                rol: 'CONTADOR',
            },
            ip: '127.0.0.1',
        };
        const esperado = {
            nombre: 'boleta.pdf',
            tipo: 'application/pdf',
            stream: 'stream simulado',
            id: 'resultado',
        };
        registrarDesembolso.execute.mockResolvedValue(esperado);
        // Act: ejecutar únicamente el método público del controlador.
        const resultado = await controller.desembolsar(
            dto as never,
            req as never
        );
        // Assert: verificar el destino, el actor y la respuesta observables.
        expect(registrarDesembolso.execute).toHaveBeenCalledWith(
            dto,
            actorSolicitud(req)
        );
        expect(resultado).toEqual(esperado);
    });
    it('desembolsar: propaga el error sin informar éxito', async () => {
        // Arrange: simular una regla de negocio rechazada por el caso de uso.
        const dto = { empleado_id: 'empleado', periodo: '2026-09', version: 1 };
        const req = {
            user: {
                id: '019a0000-0002-7000-8000-000000000003',
                rol: 'CONTADOR',
            },
            ip: '127.0.0.1',
        };
        const error = new Error('Operación rechazada');
        registrarDesembolso.execute.mockRejectedValue(error);
        // Act: solicitar la operación.
        const operacion = Promise.resolve().then(() =>
            controller.desembolsar(dto as never, req as never)
        );
        // Assert: conservar el error para que el filtro HTTP lo traduzca.
        await expect(operacion).rejects.toBe(error);
    });
});
