import { N8nInternoController } from '@/modules/integraciones/controller/n8n-interno.controller';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import 'reflect-metadata';

/** Unitarias del controlador. Los pipes y las guardias HTTP se comprueban en integración. */
describe('N8nInternoController', () => {
  const atender = {
    validar: jest.fn(),
    reclamar: jest.fn(),
    finalizar: jest.fn(),
  };
  const datos = { pagina: jest.fn() };
  const controller = new N8nInternoController(atender as never, datos as never);
  beforeEach(() => jest.clearAllMocks());
  it('validar: conserva los parámetros y el resultado del caso de uso', async () => {
    // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
    const dto = { empleado_id: 'empleado', periodo: '2026-09', version: 1 };
    const esperado = {
      nombre: 'boleta.pdf',
      tipo: 'application/pdf',
      stream: 'stream simulado',
      id: 'resultado',
    };
    atender.validar.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.validar(dto as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(atender.validar).toHaveBeenCalledWith(dto.trabajo_id);
    expect(resultado).toEqual(esperado);
  });
  it('validar: propaga el error sin informar éxito', async () => {
    // Arrange: simular una regla de negocio rechazada por el caso de uso.
    const dto = { empleado_id: 'empleado', periodo: '2026-09', version: 1 };
    const error = new Error('Operación rechazada');
    atender.validar.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.validar(dto as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('reclamar: conserva los parámetros y el resultado del caso de uso', async () => {
    // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
    const id = '019a0000-0001-7000-8000-000000000001';
    const dto = { empleado_id: 'empleado', periodo: '2026-09', version: 1 };
    const esperado = {
      nombre: 'boleta.pdf',
      tipo: 'application/pdf',
      stream: 'stream simulado',
      id: 'resultado',
    };
    atender.reclamar.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.reclamar(id as never, dto as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(atender.reclamar).toHaveBeenCalledWith(id, dto.ejecucion_id);
    expect(resultado).toEqual(esperado);
  });
  it('reclamar: propaga el error sin informar éxito', async () => {
    // Arrange: simular una regla de negocio rechazada por el caso de uso.
    const id = '019a0000-0001-7000-8000-000000000001';
    const dto = { empleado_id: 'empleado', periodo: '2026-09', version: 1 };
    const error = new Error('Operación rechazada');
    atender.reclamar.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.reclamar(id as never, dto as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('datosPagina: conserva los parámetros y el resultado del caso de uso', async () => {
    // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
    const id = '019a0000-0001-7000-8000-000000000001';
    const pagina = 0;
    const ejecucionId = '019a0000-0001-7000-8000-000000000001';
    const esperado = {
      nombre: 'boleta.pdf',
      tipo: 'application/pdf',
      stream: 'stream simulado',
      id: 'resultado',
    };
    datos.pagina.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.datosPagina(
      id as never,
      pagina as never,
      ejecucionId as never
    );
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(datos.pagina).toHaveBeenCalledWith(id, pagina, ejecucionId);
    expect(resultado).toEqual(esperado);
  });
  it('datosPagina: propaga el error sin informar éxito', async () => {
    // Arrange: simular una regla de negocio rechazada por el caso de uso.
    const id = '019a0000-0001-7000-8000-000000000001';
    const pagina = 0;
    const ejecucionId = '019a0000-0001-7000-8000-000000000001';
    const error = new Error('Operación rechazada');
    datos.pagina.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.datosPagina(id as never, pagina as never, ejecucionId as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('finalizar: conserva los parámetros y el resultado del caso de uso', async () => {
    // Arrange: preparar dependencias aisladas, sin HTTP ni base de datos.
    const id = '019a0000-0001-7000-8000-000000000001';
    const ejecucionId = '019a0000-0001-7000-8000-000000000001';
    const dto = { empleado_id: 'empleado', periodo: '2026-09', version: 1 };
    const esperado = {
      nombre: 'boleta.pdf',
      tipo: 'application/pdf',
      stream: 'stream simulado',
      id: 'resultado',
    };
    atender.finalizar.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.finalizar(
      id as never,
      ejecucionId as never,
      dto as never
    );
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(atender.finalizar).toHaveBeenCalledWith(id, ejecucionId, dto);
    expect(resultado).toEqual(esperado);
  });
  it('finalizar: propaga el error sin informar éxito', async () => {
    // Arrange: simular una regla de negocio rechazada por el caso de uso.
    const id = '019a0000-0001-7000-8000-000000000001';
    const ejecucionId = '019a0000-0001-7000-8000-000000000001';
    const dto = { empleado_id: 'empleado', periodo: '2026-09', version: 1 };
    const error = new Error('Operación rechazada');
    atender.finalizar.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.finalizar(id as never, ejecucionId as never, dto as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
});
