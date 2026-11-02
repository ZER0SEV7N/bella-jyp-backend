import { GestionAsistenciaController } from '@/modules/asistencia/controller/gestion-asistencia.controller';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import 'reflect-metadata';

/** Unitarias del controlador. Los pipes y las guardias HTTP se comprueban en integración. */
describe('GestionAsistenciaController', () => {
  const obtenerDetalleAsistencia = { execute: jest.fn() };
  const resolverDiaAsistencia = { execute: jest.fn() };
  const asignarJornadaAsistencia = { execute: jest.fn() };
  const guardarDescansoAsistencia = { execute: jest.fn() };
  const resolverIncidencia = { execute: jest.fn() };
  const controller = new GestionAsistenciaController(
    obtenerDetalleAsistencia as never,
    resolverDiaAsistencia as never,
    asignarJornadaAsistencia as never,
    guardarDescansoAsistencia as never,
    resolverIncidencia as never
  );
  beforeEach(() => jest.clearAllMocks());
  it('detalle: conserva los parámetros y el resultado del caso de uso', async () => {
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
    obtenerDetalleAsistencia.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.detalle(query as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(obtenerDetalleAsistencia.execute).toHaveBeenCalledWith(
      query.empleado_id,
      query.periodo
    );
    expect(resultado).toEqual(esperado);
  });
  it('detalle: propaga el error sin informar éxito', async () => {
    // Arrange: simular una regla de negocio rechazada por el caso de uso.
    const query = {
      empleado_id: 'empleado',
      periodo: '2026-09',
      version: 1,
    };
    const error = new Error('Operación rechazada');
    obtenerDetalleAsistencia.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.detalle(query as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('resolver: conserva los parámetros y el resultado del caso de uso', async () => {
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
    resolverDiaAsistencia.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.resolver(dto as never, req as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(resolverDiaAsistencia.execute).toHaveBeenCalledWith(
      dto,
      actorSolicitud(req)
    );
    expect(resultado).toEqual(esperado);
  });
  it('resolver: propaga el error sin informar éxito', async () => {
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
    resolverDiaAsistencia.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.resolver(dto as never, req as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('asignar: conserva los parámetros y el resultado del caso de uso', async () => {
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
    asignarJornadaAsistencia.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.asignar(dto as never, req as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(asignarJornadaAsistencia.execute).toHaveBeenCalledWith(
      dto,
      actorSolicitud(req)
    );
    expect(resultado).toEqual(esperado);
  });
  it('asignar: propaga el error sin informar éxito', async () => {
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
    asignarJornadaAsistencia.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.asignar(dto as never, req as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('calendario: conserva los parámetros y el resultado del caso de uso', async () => {
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
    guardarDescansoAsistencia.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.calendario(dto as never, req as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(guardarDescansoAsistencia.execute).toHaveBeenCalledWith(
      dto,
      actorSolicitud(req)
    );
    expect(resultado).toEqual(esperado);
  });
  it('calendario: propaga el error sin informar éxito', async () => {
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
    guardarDescansoAsistencia.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.calendario(dto as never, req as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('revisar: conserva los parámetros y el resultado del caso de uso', async () => {
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
    resolverIncidencia.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.revisar(dto as never, req as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(resolverIncidencia.execute).toHaveBeenCalledWith(
      dto,
      actorSolicitud(req)
    );
    expect(resultado).toEqual(esperado);
  });
  it('revisar: propaga el error sin informar éxito', async () => {
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
    resolverIncidencia.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.revisar(dto as never, req as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
});
