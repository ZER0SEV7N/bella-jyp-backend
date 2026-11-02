import { ExportacionesController } from '@/modules/integraciones/controller/exportaciones.controller';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import 'reflect-metadata';

/** Unitarias del controlador. Los pipes y las guardias HTTP se comprueban en integración. */
describe('ExportacionesController', () => {
  const crear = { execute: jest.fn() };
  const consultar = { execute: jest.fn(), archivo: jest.fn() };
  const controller = new ExportacionesController(
    crear as never,
    consultar as never
  );
  beforeEach(() => jest.clearAllMocks());
  it('solicitar: conserva los parámetros y el resultado del caso de uso', async () => {
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
    crear.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.solicitar(dto as never, req as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(crear.execute).toHaveBeenCalledWith(dto, actorSolicitud(req));
    expect(resultado).toEqual(esperado);
  });
  it('solicitar: propaga el error sin informar éxito', async () => {
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
    crear.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.solicitar(dto as never, req as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('estado: conserva los parámetros y el resultado del caso de uso', async () => {
    // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
    const id = '019a0000-0001-7000-8000-000000000001';
    const esperado = {
      nombre: 'boleta.pdf',
      tipo: 'application/pdf',
      stream: 'stream simulado',
      id: 'resultado',
    };
    consultar.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.estado(id as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(consultar.execute).toHaveBeenCalledWith(id);
    expect(resultado).toEqual(esperado);
  });
  it('estado: propaga el error sin informar éxito', async () => {
    // Arrange: simular una regla de negocio rechazada por el caso de uso.
    const id = '019a0000-0001-7000-8000-000000000001';
    const error = new Error('Operación rechazada');
    consultar.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.estado(id as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('archivo: conserva los parámetros y el resultado del caso de uso', async () => {
    // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
    const id = '019a0000-0001-7000-8000-000000000001';
    const nombre = '019a0000-0001-7000-8000-000000000001';
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
    consultar.archivo.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.archivo(
      id as never,
      nombre as never,
      reply as never
    );
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(consultar.archivo).toHaveBeenCalledWith(id, nombre);
    expect(reply.send).toHaveBeenCalledWith(esperado.stream);
  });
  it('archivo: propaga el error sin informar éxito', async () => {
    // Arrange: simular una regla de negocio rechazada por el caso de uso.
    const id = '019a0000-0001-7000-8000-000000000001';
    const nombre = '019a0000-0001-7000-8000-000000000001';
    const reply = {
      type: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnValue('enviado'),
    };
    const error = new Error('Operación rechazada');
    consultar.archivo.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.archivo(id as never, nombre as never, reply as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
});
