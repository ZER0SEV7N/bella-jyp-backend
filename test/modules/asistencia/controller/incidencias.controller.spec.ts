import { IncidenciasController } from '@/modules/asistencia/controller/incidencias.controller';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import 'reflect-metadata';

/** Unitarias del controlador. Los pipes y las guardias HTTP se comprueban en integración. */
describe('IncidenciasController', () => {
  const generarIncidenciasMesUseCase = { execute: jest.fn() };
  const aprobarIncidenciasUseCase = { execute: jest.fn() };
  const listarIncidenciasMesUseCase = {
    execute: jest.fn(),
    obtenerPorId: jest.fn(),
  };
  const controller = new IncidenciasController(
    generarIncidenciasMesUseCase as never,
    aprobarIncidenciasUseCase as never,
    listarIncidenciasMesUseCase as never
  );
  beforeEach(() => jest.clearAllMocks());
  it('generarCierre: conserva los parámetros y el resultado del caso de uso', async () => {
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
    generarIncidenciasMesUseCase.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.generarCierre(
      dto as never,
      req as never
    );
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(generarIncidenciasMesUseCase.execute).toHaveBeenCalledWith(
      dto,
      actorSolicitud(req)
    );
    expect(resultado).toEqual(esperado);
  });
  it('generarCierre: propaga el error sin informar éxito', async () => {
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
    generarIncidenciasMesUseCase.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.generarCierre(dto as never, req as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('aprobarIncidencias: conserva los parámetros y el resultado del caso de uso', async () => {
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
    aprobarIncidenciasUseCase.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.aprobarIncidencias(
      dto as never,
      req as never
    );
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(aprobarIncidenciasUseCase.execute).toHaveBeenCalledWith(
      dto,
      actorSolicitud(req)
    );
    expect(resultado).toEqual(esperado);
  });
  it('aprobarIncidencias: propaga el error sin informar éxito', async () => {
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
    aprobarIncidenciasUseCase.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.aprobarIncidencias(dto as never, req as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('listarIncidencias: conserva los parámetros y el resultado del caso de uso', async () => {
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
    listarIncidenciasMesUseCase.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.listarIncidencias(query as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(listarIncidenciasMesUseCase.execute).toHaveBeenCalledWith(query);
    expect(resultado).toEqual(esperado);
  });
  it('listarIncidencias: propaga el error sin informar éxito', async () => {
    // Arrange: simular una regla de negocio rechazada por el caso de uso.
    const query = {
      empleado_id: 'empleado',
      periodo: '2026-09',
      version: 1,
    };
    const error = new Error('Operación rechazada');
    listarIncidenciasMesUseCase.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.listarIncidencias(query as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('obtenerPorId: conserva los parámetros y el resultado del caso de uso', async () => {
    // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
    const id = '019a0000-0001-7000-8000-000000000001';
    const esperado = {
      nombre: 'boleta.pdf',
      tipo: 'application/pdf',
      stream: 'stream simulado',
      id: 'resultado',
    };
    listarIncidenciasMesUseCase.obtenerPorId.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.obtenerPorId(id as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(listarIncidenciasMesUseCase.obtenerPorId).toHaveBeenCalledWith(id);
    expect(resultado).toEqual(esperado);
  });
  it('obtenerPorId: propaga el error sin informar éxito', async () => {
    // Arrange: simular una regla de negocio rechazada por el caso de uso.
    const id = '019a0000-0001-7000-8000-000000000001';
    const error = new Error('Operación rechazada');
    listarIncidenciasMesUseCase.obtenerPorId.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.obtenerPorId(id as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
});
