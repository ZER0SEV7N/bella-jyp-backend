import { NovedadesPlanillaController } from '@/modules/payroll/planillas/controller/novedades-planilla.controller';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import 'reflect-metadata';

/** Unitarias del controlador. Los pipes y las guardias HTTP se comprueban en integración. */
describe('NovedadesPlanillaController', () => {
    const crearNovedadPlanilla = { execute: jest.fn() };
    const resolverNovedadPlanilla = { execute: jest.fn() };
    const listarNovedadesPlanilla = { execute: jest.fn() };
    const controller = new NovedadesPlanillaController(
        crearNovedadPlanilla as never,
        resolverNovedadPlanilla as never,
        listarNovedadesPlanilla as never
    );
    beforeEach(() => jest.clearAllMocks());
    it('crearNovedad: conserva los parámetros y el resultado del caso de uso', async () => {
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
        crearNovedadPlanilla.execute.mockResolvedValue(esperado);
        // Act: ejecutar únicamente el método público del controlador.
        const resultado = await controller.crearNovedad(
            dto as never,
            req as never
        );
        // Assert: verificar el destino, el actor y la respuesta observables.
        expect(crearNovedadPlanilla.execute).toHaveBeenCalledWith(
            dto,
            actorSolicitud(req)
        );
        expect(resultado).toEqual(esperado);
    });
    it('crearNovedad: propaga el error sin informar éxito', async () => {
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
        crearNovedadPlanilla.execute.mockRejectedValue(error);
        // Act: solicitar la operación.
        const operacion = Promise.resolve().then(() =>
            controller.crearNovedad(dto as never, req as never)
        );
        // Assert: conservar el error para que el filtro HTTP lo traduzca.
        await expect(operacion).rejects.toBe(error);
    });
    it('resolverNovedad: conserva los parámetros y el resultado del caso de uso', async () => {
        // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
        const id = '019a0000-0001-7000-8000-000000000001';
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
        resolverNovedadPlanilla.execute.mockResolvedValue(esperado);
        // Act: ejecutar únicamente el método público del controlador.
        const resultado = await controller.resolverNovedad(
            id as never,
            dto as never,
            req as never
        );
        // Assert: verificar el destino, el actor y la respuesta observables.
        expect(resolverNovedadPlanilla.execute).toHaveBeenCalledWith(
            id,
            dto,
            actorSolicitud(req)
        );
        expect(resultado).toEqual(esperado);
    });
    it('resolverNovedad: propaga el error sin informar éxito', async () => {
        // Arrange: simular una regla de negocio rechazada por el caso de uso.
        const id = '019a0000-0001-7000-8000-000000000001';
        const dto = { empleado_id: 'empleado', periodo: '2026-09', version: 1 };
        const req = {
            user: {
                id: '019a0000-0002-7000-8000-000000000003',
                rol: 'CONTADOR',
            },
            ip: '127.0.0.1',
        };
        const error = new Error('Operación rechazada');
        resolverNovedadPlanilla.execute.mockRejectedValue(error);
        // Act: solicitar la operación.
        const operacion = Promise.resolve().then(() =>
            controller.resolverNovedad(id as never, dto as never, req as never)
        );
        // Assert: conservar el error para que el filtro HTTP lo traduzca.
        await expect(operacion).rejects.toBe(error);
    });
    it('listarNovedades: conserva los parámetros y el resultado del caso de uso', async () => {
        // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
        const query = {
            empleado_id: 'empleado',
            periodo: '2026-09',
            version: 1,
        };
        const esperado = {
            nombre: 'boleta.pdf',
            tipo: 'application/pdf',
            stream: 'stream simulado',
            id: 'resultado',
        };
        listarNovedadesPlanilla.execute.mockResolvedValue(esperado);
        // Act: ejecutar únicamente el método público del controlador.
        const resultado = await controller.listarNovedades(query as never);
        // Assert: verificar el destino, el actor y la respuesta observables.
        expect(listarNovedadesPlanilla.execute).toHaveBeenCalledWith(
            query.empleado_id,
            query.periodo
        );
        expect(resultado).toEqual(esperado);
    });
    it('listarNovedades: propaga el error sin informar éxito', async () => {
        // Arrange: simular una regla de negocio rechazada por el caso de uso.
        const query = {
            empleado_id: 'empleado',
            periodo: '2026-09',
            version: 1,
        };
        const error = new Error('Operación rechazada');
        listarNovedadesPlanilla.execute.mockRejectedValue(error);
        // Act: solicitar la operación.
        const operacion = Promise.resolve().then(() =>
            controller.listarNovedades(query as never)
        );
        // Assert: conservar el error para que el filtro HTTP lo traduzca.
        await expect(operacion).rejects.toBe(error);
    });
});
