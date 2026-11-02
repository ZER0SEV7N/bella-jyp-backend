import { AsistenciaController } from '@/modules/asistencia/controller/asistencias.controller';
import { actorSolicitud } from '@/common/utils/actor-operacion.util';
import 'reflect-metadata';

/** Unitarias del controlador. Los pipes y las guardias HTTP se comprueban en integración. */
describe('AsistenciaController', () => {
  const crearMarcacionManualUseCase = { execute: jest.fn() };
  const listarMarcacionesUseCase = { execute: jest.fn() };
  const controller = new AsistenciaController(
    crearMarcacionManualUseCase as never,
    listarMarcacionesUseCase as never
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
    crearMarcacionManualUseCase.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.generarCierre(
      dto as never,
      req as never
    );
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(crearMarcacionManualUseCase.execute).toHaveBeenCalledWith(
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
    crearMarcacionManualUseCase.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.generarCierre(dto as never, req as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
  it('listarMarcaciones: conserva los parámetros y el resultado del caso de uso', async () => {
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
    listarMarcacionesUseCase.execute.mockResolvedValue(esperado);
    // Act: ejecutar únicamente el método público del controlador.
    const resultado = await controller.listarMarcaciones(query as never);
    // Assert: verificar el destino, el actor y la respuesta observables.
    expect(listarMarcacionesUseCase.execute).toHaveBeenCalledWith(query);
    expect(resultado).toEqual(esperado);
  });
  it('listarMarcaciones: propaga el error sin informar éxito', async () => {
    // Arrange: simular una regla de negocio rechazada por el caso de uso.
    const query = {
      empleado_id: 'empleado',
      periodo: '2026-09',
      version: 1,
    };
    const error = new Error('Operación rechazada');
    listarMarcacionesUseCase.execute.mockRejectedValue(error);
    // Act: solicitar la operación.
    const operacion = Promise.resolve().then(() =>
      controller.listarMarcaciones(query as never)
    );
    // Assert: conservar el error para que el filtro HTTP lo traduzca.
    await expect(operacion).rejects.toBe(error);
  });
});
