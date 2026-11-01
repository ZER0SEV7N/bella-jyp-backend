import { PlanillasController } from '@/modules/payroll/planillas/controller/planillas.controller';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import 'reflect-metadata';

/** Unitarias del controlador. Los pipes y las guardias HTTP se comprueban en integración. */
describe('PlanillasController', () => {
    const solicitarGeneracionPlanillas = { execute: jest.fn() };
    const consultarTrabajoPlanillas = { execute: jest.fn() };
    const listarPlanillas = { execute: jest.fn() };
    const obtenerPlanilla = { execute: jest.fn() };
    const descargarBoleta = { execute: jest.fn() };
    const congelarPlanilla = { execute: jest.fn() };
    const controller = new PlanillasController(
        solicitarGeneracionPlanillas as never,
        consultarTrabajoPlanillas as never,
        listarPlanillas as never,
        obtenerPlanilla as never,
        descargarBoleta as never,
        congelarPlanilla as never
    );
    beforeEach(() => jest.clearAllMocks());
    it('generar: conserva los parámetros y el resultado del caso de uso', async () => {
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
        solicitarGeneracionPlanillas.execute.mockResolvedValue(esperado);
        // Act: ejecutar únicamente el método público del controlador.
        const resultado = await controller.generar(dto as never, req as never);
        // Assert: verificar el destino, el actor y la respuesta observables.
        expect(solicitarGeneracionPlanillas.execute).toHaveBeenCalledWith(
            dto,
            actorSolicitud(req)
        );
        expect(resultado).toEqual(esperado);
    });
    it('generar: propaga el error sin informar éxito', async () => {
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
        solicitarGeneracionPlanillas.execute.mockRejectedValue(error);
        // Act: solicitar la operación.
        const operacion = Promise.resolve().then(() =>
            controller.generar(dto as never, req as never)
        );
        // Assert: conservar el error para que el filtro HTTP lo traduzca.
        await expect(operacion).rejects.toBe(error);
    });
    it('consultar: conserva los parámetros y el resultado del caso de uso', async () => {
        // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
        const id = '019a0000-0001-7000-8000-000000000001';
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
        consultarTrabajoPlanillas.execute.mockResolvedValue(esperado);
        // Act: ejecutar únicamente el método público del controlador.
        const resultado = await controller.consultar(id as never, req as never);
        // Assert: verificar el destino, el actor y la respuesta observables.
        expect(consultarTrabajoPlanillas.execute).toHaveBeenCalledWith(
            id,
            actorSolicitud(req),
            req.user.rol
        );
        expect(resultado).toEqual(esperado);
    });
    it('consultar: propaga el error sin informar éxito', async () => {
        // Arrange: simular una regla de negocio rechazada por el caso de uso.
        const id = '019a0000-0001-7000-8000-000000000001';
        const req = {
            user: {
                id: '019a0000-0002-7000-8000-000000000003',
                rol: 'CONTADOR',
            },
            ip: '127.0.0.1',
        };
        const error = new Error('Operación rechazada');
        consultarTrabajoPlanillas.execute.mockRejectedValue(error);
        // Act: solicitar la operación.
        const operacion = Promise.resolve().then(() =>
            controller.consultar(id as never, req as never)
        );
        // Assert: conservar el error para que el filtro HTTP lo traduzca.
        await expect(operacion).rejects.toBe(error);
    });
    it('listar: conserva los parámetros y el resultado del caso de uso', async () => {
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
        listarPlanillas.execute.mockResolvedValue(esperado);
        // Act: ejecutar únicamente el método público del controlador.
        const resultado = await controller.listar(query as never);
        // Assert: verificar el destino, el actor y la respuesta observables.
        expect(listarPlanillas.execute).toHaveBeenCalledWith(query);
        expect(resultado).toEqual(esperado);
    });
    it('listar: propaga el error sin informar éxito', async () => {
        // Arrange: simular una regla de negocio rechazada por el caso de uso.
        const query = {
            empleado_id: 'empleado',
            periodo: '2026-09',
            version: 1,
        };
        const error = new Error('Operación rechazada');
        listarPlanillas.execute.mockRejectedValue(error);
        // Act: solicitar la operación.
        const operacion = Promise.resolve().then(() =>
            controller.listar(query as never)
        );
        // Assert: conservar el error para que el filtro HTTP lo traduzca.
        await expect(operacion).rejects.toBe(error);
    });
    it('detalle: conserva los parámetros y el resultado del caso de uso', async () => {
        // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
        const id = '019a0000-0001-7000-8000-000000000001';
        const esperado = {
            nombre: 'boleta.pdf',
            tipo: 'application/pdf',
            stream: 'stream simulado',
            id: 'resultado',
        };
        obtenerPlanilla.execute.mockResolvedValue(esperado);
        // Act: ejecutar únicamente el método público del controlador.
        const resultado = await controller.detalle(id as never);
        // Assert: verificar el destino, el actor y la respuesta observables.
        expect(obtenerPlanilla.execute).toHaveBeenCalledWith(id);
        expect(resultado).toEqual(esperado);
    });
    it('detalle: propaga el error sin informar éxito', async () => {
        // Arrange: simular una regla de negocio rechazada por el caso de uso.
        const id = '019a0000-0001-7000-8000-000000000001';
        const error = new Error('Operación rechazada');
        obtenerPlanilla.execute.mockRejectedValue(error);
        // Act: solicitar la operación.
        const operacion = Promise.resolve().then(() =>
            controller.detalle(id as never)
        );
        // Assert: conservar el error para que el filtro HTTP lo traduzca.
        await expect(operacion).rejects.toBe(error);
    });
    it('boleta: conserva los parámetros y el resultado del caso de uso', async () => {
        // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
        const id = '019a0000-0001-7000-8000-000000000001';
        const reply = {
            type: jest.fn().mockReturnThis(),
            header: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnValue('enviado'),
        };
        const esperado = {
            nombre: 'boleta.pdf',
            tipo: 'application/pdf',
            stream: 'stream simulado',
            id: 'resultado',
        };
        descargarBoleta.execute.mockResolvedValue(esperado);
        // Act: ejecutar únicamente el método público del controlador.
        const resultado = await controller.boleta(id as never, reply as never);
        // Assert: verificar el destino, el actor y la respuesta observables.
        expect(descargarBoleta.execute).toHaveBeenCalledWith(id);
        expect(reply.send).toHaveBeenCalledWith(esperado.stream);
    });
    it('boleta: propaga el error sin informar éxito', async () => {
        // Arrange: simular una regla de negocio rechazada por el caso de uso.
        const id = '019a0000-0001-7000-8000-000000000001';
        const reply = {
            type: jest.fn().mockReturnThis(),
            header: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnValue('enviado'),
        };
        const error = new Error('Operación rechazada');
        descargarBoleta.execute.mockRejectedValue(error);
        // Act: solicitar la operación.
        const operacion = Promise.resolve().then(() =>
            controller.boleta(id as never, reply as never)
        );
        // Assert: conservar el error para que el filtro HTTP lo traduzca.
        await expect(operacion).rejects.toBe(error);
    });
    it('congelar: conserva los parámetros y el resultado del caso de uso', async () => {
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
        congelarPlanilla.execute.mockResolvedValue(esperado);
        // Act: ejecutar únicamente el método público del controlador.
        const resultado = await controller.congelar(
            id as never,
            dto as never,
            req as never
        );
        // Assert: verificar el destino, el actor y la respuesta observables.
        expect(congelarPlanilla.execute).toHaveBeenCalledWith(
            id,
            dto,
            actorSolicitud(req)
        );
        expect(resultado).toEqual(esperado);
    });
    it('congelar: propaga el error sin informar éxito', async () => {
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
        congelarPlanilla.execute.mockRejectedValue(error);
        // Act: solicitar la operación.
        const operacion = Promise.resolve().then(() =>
            controller.congelar(id as never, dto as never, req as never)
        );
        // Assert: conservar el error para que el filtro HTTP lo traduzca.
        await expect(operacion).rejects.toBe(error);
    });
});
