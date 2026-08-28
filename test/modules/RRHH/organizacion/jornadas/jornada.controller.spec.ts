//test/modules/RRHH/organizacion/jornadas/jornada.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {BadRequestException, NotFoundException, InternalServerErrorException} from '@nestjs/common';
import { JornadaController } from '@/modules/RRHH/organizacion/controller/jornada.controller';
import { CrearJornadaUseCase } from '@/modules/RRHH/organizacion/use-cases/jornadas/crearJornada.useCase';
import { EditarJornadaUseCase } from '@/modules/RRHH/organizacion/use-cases/jornadas/editarJornada.useCase';
import { EstadoJornadaUseCase } from '@/modules/RRHH/organizacion/use-cases/jornadas/estadoJornada.useCase';
import { ListarJornadaUseCase } from '@/modules/RRHH/organizacion/use-cases/jornadas/listarJornada.useCase';
import type {CrearJornadaDto,ActualizarJornadaDto, ListarJornadasQueryDto} from '@jyp/shared-contracts';

/** 
 * Pruebas unitarias exhaustivas para los endpoints HTTP del controlador de jornadas.
 * Se simula el comportamiento de los casos de uso asociados a la creación, edición, desactivación/reactivación y listado de jornadas.
 * Se validan tanto los escenarios de éxito (Happy Path) como los casos de error, incluyendo excepciones de negocio y fallos inesperados.
 * Se asegura que el controlador delegue correctamente la lógica a los casos de uso y maneje adecuadamente las respuestas y excepciones.
 */
describe('JornadaController - Pruebas Unitarias Exhaustivas de Endpoints HTTP', () => {
  let controller: JornadaController;

  //Mocks de los casos de uso para simular la lógica de negocio sin depender de la base de datos
  const mockCrearJornadaUseCase = {execute: jest.fn()};
  const mockEditarJornadaUseCase = {execute: jest.fn()};
  const mockEstadoJornadaUseCase = {desactivar: jest.fn(), reactivar: jest.fn()};
  const mockListarJornadaUseCase = {execute: jest.fn()};

  const mockJornadaId = '018f4a7c-6666-7000-f000-000000000001';

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JornadaController],
      providers: [
        { provide: CrearJornadaUseCase, useValue: mockCrearJornadaUseCase },
        { provide: EditarJornadaUseCase, useValue: mockEditarJornadaUseCase },
        { provide: EstadoJornadaUseCase, useValue: mockEstadoJornadaUseCase },
        { provide: ListarJornadaUseCase, useValue: mockListarJornadaUseCase }
      ]
    }).compile();

    controller = module.get<JornadaController>(JornadaController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('POST /api/rrhh/jornada/crear - crear()', () => {
    //Definir un payload de ejemplo para la creación de una jornada laboral
    const payload: CrearJornadaDto = {
      nombre: 'Turno Mañana (Oficina Central)',
      tipo_jornada: 'FIJA',
      hora_entrada: '08:00',
      hora_salida: '17:00',
      tolerancia_minutos: 15,
      activo: true
    };

    it('Happy Path: Debe crear exitosamente una jornada laboral y retornar el registro creado', async () => {
      //Arrange: Se simula la respuesta del caso de uso CrearJornadaUseCase con un objeto que representa la jornada creada
      const mockCreatedJornada = {
        id: mockJornadaId,
        ...payload,
        deleted_at: null
      };

      mockCrearJornadaUseCase.execute.mockResolvedValueOnce(mockCreatedJornada);

      //Act: Se llama al método del controlador para crear la jornada
      const result = await controller.crearJornada(payload);

      //Assert: Se verifica que el caso de uso haya sido llamado con el payload correcto y que el resultado sea el esperado
      expect(mockCrearJornadaUseCase.execute).toHaveBeenCalledWith(payload);
      expect(result).toEqual(mockCreatedJornada);
    });

    it('Excepción / Negocio: Debe propagar BadRequestException si el nombre de jornada ya existe', async () => {
      //Arrange: Se simula que el caso de uso CrearJornadaUseCase lanza una excepción de negocio indicando que la jornada ya existe
      mockCrearJornadaUseCase.execute.mockRejectedValueOnce(new BadRequestException({
        title: 'Jornada duplicada',
        detail: `Ya existe una jornada/turno con el nombre '${payload.nombre}'.`
      }));

      //Act & Assert: Se espera que el controlador propague la excepción como BadRequestException
      await expect(controller.crearJornada(payload)).rejects.toThrow(BadRequestException);
      expect(mockCrearJornadaUseCase.execute).toHaveBeenCalledWith(payload);
    });

    it('Excepción / Resiliencia: Debe propagar InternalServerErrorException en caso de fallo crítico en BD', async () => {
      //Arrange: Se simula que el caso de uso CrearJornadaUseCase lanza una excepción inesperada
      mockCrearJornadaUseCase.execute.mockRejectedValueOnce(new InternalServerErrorException('Error interno al crear la jornada.'));

      //Act & Assert: Se espera que el controlador propague la excepción como InternalServerErrorException
      await expect(controller.crearJornada(payload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('PUT /api/rrhh/jornada/:id/actualizar - update()', () => {
    //Definir un payload de ejemplo para la actualización de una jornada laboral
    const payload: ActualizarJornadaDto = {
      nombre: 'Turno Mañana Extendida',
      tolerancia_minutos: 20
    };

    it('Happy Path: Debe actualizar los atributos de la jornada y retornar el registro modificado', async () => {
      //Arrange: Se simula la respuesta del caso de uso EditarJornadaUseCase con un objeto que representa la jornada actualizada
      const mockUpdatedJornada = {
        id: mockJornadaId,
        nombre: 'Turno Mañana Extendida',
        tipo_jornada: 'FIJA',
        tolerancia_minutos: 20,
        activo: true,
        deleted_at: null
      };

      mockEditarJornadaUseCase.execute.mockResolvedValueOnce(mockUpdatedJornada);

      //Act: Se llama al método del controlador para actualizar la jornada
      const result = await controller.actualizarJornada(mockJornadaId, payload);

      //Assert: Se verifica que el caso de uso haya sido llamado con el ID y payload correctos, y que el resultado sea el esperado
      expect(mockEditarJornadaUseCase.execute).toHaveBeenCalledWith(mockJornadaId, payload);
      expect(result).toEqual(mockUpdatedJornada);
    });

    it('Excepción: Debe propagar NotFoundException si la jornada a actualizar no existe o fue dada de baja', async () => {
      //Arrange: Se simula que el caso de uso EditarJornadaUseCase lanza una excepción NotFoundException indicando que la jornada no existe
      mockEditarJornadaUseCase.execute.mockRejectedValueOnce(new NotFoundException({
        title: 'Jornada no encontrada',
        detail: 'El turno no existe o ha sido eliminado.',
      }));

      //Act & Assert: Se espera que el controlador propague la excepción como NotFoundException
      await expect(controller.actualizarJornada(mockJornadaId, payload)).rejects.toThrow(NotFoundException);
    });

    it('Excepción / Negocio: Debe propagar BadRequestException si el nombre colisiona con otra jornada activa', async () => {
      //Arrange: Se simula que el caso de uso EditarJornadaUseCase lanza una excepción BadRequestException indicando que el nombre ya está en uso
      mockEditarJornadaUseCase.execute.mockRejectedValueOnce(new BadRequestException({
        title: 'Nombre de jornada en uso',
        detail: 'Ya existe otra jornada registrada con ese nombre.',
      }));

      //Act & Assert: Se espera que el controlador propague la excepción como BadRequestException
      await expect(controller.actualizarJornada(mockJornadaId, payload)).rejects.toThrow(BadRequestException);
    });

    it('Excepción / Resiliencia: Debe propagar InternalServerErrorException ante fallos inesperados', async () => {
      //Arrange: Se simula que el caso de uso EditarJornadaUseCase lanza una excepción inesperada
      mockEditarJornadaUseCase.execute.mockRejectedValueOnce(new InternalServerErrorException('Fallo interno al actualizar la jornada.'));

      //Act & Assert: Se espera que el controlador propague la excepción como InternalServerErrorException
      await expect(controller.actualizarJornada(mockJornadaId, payload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('DELETE /api/rrhh/jornada/:id/desactive - eliminar()', () => {
    it('Happy Path: Debe desactivar la jornada aplicando Soft Delete y retornar activo=false', async () => {
      //Arrange: Se simula la respuesta del caso de uso EstadoJornadaUseCase.desactivar con un objeto que representa la jornada desactivada
      const mockDesactivada = {
        id: mockJornadaId,
        nombre: 'Turno Noche',
        activo: false,
        deleted_at: new Date()
      };

      mockEstadoJornadaUseCase.desactivar.mockResolvedValueOnce(mockDesactivada);

      //Act: Se llama al método del controlador para desactivar la jornada
      const result = await controller.desactivarJornada(mockJornadaId);

      //Assert: Se verifica que el caso de uso haya sido llamado con el ID correcto y que el resultado sea el esperado
      expect(mockEstadoJornadaUseCase.desactivar).toHaveBeenCalledWith(mockJornadaId);
      expect(result).toEqual(mockDesactivada);
      expect(result.activo).toBe(false);
    });

    it('Regla de Negocio: Debe propagar BadRequestException si existen colaboradores asignados al turno', async () => {
      //Arrange: Se simula que el caso de uso EstadoJornadaUseCase.desactivar 
      //lanza una excepción BadRequestException indicando que hay empleados asignados al turno
      mockEstadoJornadaUseCase.desactivar.mockRejectedValueOnce(new BadRequestException({
        title: 'Desactivación Bloqueada',
        detail: 'Hay 5 empleado(s) usando este turno. Reasígnalos primero.'
      }));

      //Act & Assert: Se espera que el controlador propague la excepción como BadRequestException
      await expect(controller.desactivarJornada(mockJornadaId)).rejects.toThrow(BadRequestException);
      expect(mockEstadoJornadaUseCase.desactivar).toHaveBeenCalledWith(mockJornadaId);
    });

    it('Excepción: Debe propagar NotFoundException si la jornada no existe o ya fue eliminada', async () => {
      //Arrange: Se simula que el caso de uso EstadoJornadaUseCase.desactivar lanza una excepción NotFoundException indicando que la jornada no existe
      mockEstadoJornadaUseCase.desactivar.mockRejectedValueOnce(new NotFoundException({
        title: 'Jornada no encontrada',
        detail: 'La jornada no existe o ya se encuentra eliminada.'
      }));

      //Act & Assert: Se espera que el controlador propague la excepción como NotFoundException
      await expect(controller.desactivarJornada(mockJornadaId)).rejects.toThrow(NotFoundException);
    });

    it('Excepción / Resiliencia: Debe propagar InternalServerErrorException en caso de error no previsto', async () => {
      //Arrange: Se simula que el caso de uso EstadoJornadaUseCase.desactivar lanza una excepción inesperada
      mockEstadoJornadaUseCase.desactivar.mockRejectedValueOnce(new InternalServerErrorException('Error al desactivar la jornada.'));

      //Act & Assert: Se espera que el controlador propague la excepción como InternalServerErrorException
      await expect(controller.desactivarJornada(mockJornadaId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('PATCH /api/rrhh/jornada/:id/reactive - reactivarJornada()', () => {
    it('Happy Path: Debe reactivar la jornada restableciendo activo=true y deleted_at=null', async () => {
      //Arrange: Se simula la respuesta del caso de uso EstadoJornadaUseCase.reactivar con un objeto que representa la jornada reactivada
      const mockReactivada = {
        id: mockJornadaId,
        nombre: 'Turno Rotativo Especial',
        activo: true,
        deleted_at: null
      };

      mockEstadoJornadaUseCase.reactivar.mockResolvedValueOnce(mockReactivada);

      //Act: Se llama al método del controlador para reactivar la jornada
      const result = await controller.reactivarJornada(mockJornadaId);

      //Assert: Se verifica que el caso de uso haya sido llamado con el ID correcto y que el resultado sea el esperado
      expect(mockEstadoJornadaUseCase.reactivar).toHaveBeenCalledWith(mockJornadaId);
      expect(result).toEqual(mockReactivada);
      expect(result.activo).toBe(true);
      expect(result.deleted_at).toBeNull();
    });

    it('Excepción: Debe propagar NotFoundException si la jornada a reactivar no existe', async () => {
      //Arrange: Se simula que el caso de uso EstadoJornadaUseCase.reactivar 
      //lanza una excepción NotFoundException indicando que la jornada no existe
      mockEstadoJornadaUseCase.reactivar.mockRejectedValueOnce(new NotFoundException({
        title: 'Jornada no encontrada',
        detail: 'La jornada especificada no existe.'
      }));

      //Act & Assert: Se espera que el controlador propague la excepción como NotFoundException
      await expect(controller.reactivarJornada(mockJornadaId)).rejects.toThrow(NotFoundException);
    });

    it('Excepción / Resiliencia: Debe propagar InternalServerErrorException si la restauración falla en BD', async () => {
      //Arrange: Se simula que el caso de uso EstadoJornadaUseCase.reactivar lanza una excepción inesperada
      mockEstadoJornadaUseCase.reactivar.mockRejectedValueOnce(new InternalServerErrorException('Fallo inesperado al restaurar la jornada.'));

      //Act & Assert: Se espera que el controlador propague la excepción como InternalServerErrorException
      await expect(controller.reactivarJornada(mockJornadaId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('GET /api/rrhh/jornada - listarJornadas()', () => {
    it('Happy Path: Debe listar jornadas paginadas aplicando filtros por modalidad y estado activo', async () => {
      //Arrange: Se configuran los parámetros de consulta para la lista de jornadas
      const queryParams: ListarJornadasQueryDto = {
        page: 1,
        limit: 10,
        tipo_jornada: 'FIJA',
        activo: true
      };

      //Se simula la respuesta del caso de uso ListarJornadaUseCase con un objeto que representa la lista de jornadas
      const mockResponse = {
        data: [{
          id: mockJornadaId,
          nombre: 'Turno Mañana (Oficina)',
          tipo_jornada: 'FIJA',
          hora_entrada: new Date('1970-01-01T08:00:00.000Z'),
          hora_salida: new Date('1970-01-01T17:00:00.000Z'),
          tolerancia_minutos: 15,
          activo: true,
          _count: { empleados: 8, cargos_sugeridos: 2 },
        }],
        meta: {total: 1, page: 1, limit: 10, totalPages: 1 }
      };

      //Act: Se simula la respuesta del caso de uso ListarJornadaUseCase.execute con la lista de jornadas
      mockListarJornadaUseCase.execute.mockResolvedValueOnce(mockResponse);

      const result = await controller.listarJornadas(queryParams);

      //Assert: Se verifica que el caso de uso haya sido llamado con los parámetros correctos y que el resultado sea el esperado
      expect(mockListarJornadaUseCase.execute).toHaveBeenCalledWith(queryParams);
      expect(result).toEqual(mockResponse);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('Happy Path: Debe listar jornadas con consulta vacía delegando al UseCase para valores por defecto', async () => {
      //Arrange: Se define una consulta vacía y se simula la respuesta del caso de uso ListarJornadaUseCase con valores por defecto
      const queryVacia = {} as ListarJornadasQueryDto;

      const mockResponseDefault = {
        data: [],
        meta: {total: 0, page: 1, limit: 50, totalPages: 0}
      };

      mockListarJornadaUseCase.execute.mockResolvedValueOnce(mockResponseDefault);

      //Act: Se llama al método del controlador para listar jornadas con consulta vacía
      const result = await controller.listarJornadas(queryVacia);

      //Assert: Se verifica que el caso de uso haya sido llamado con la consulta vacía y que el resultado sea el esperado
      expect(mockListarJornadaUseCase.execute).toHaveBeenCalledWith(queryVacia);
      expect(result).toEqual(mockResponseDefault);
    });

    it('Excepción / Resiliencia: Debe propagar InternalServerErrorException si la consulta transaccional falla', async () => {
      //Arrange: Se define una consulta con parámetros por defecto y se simula un fallo en el caso de uso ListarJornadaUseCase.execute
      const queryParams: ListarJornadasQueryDto = { page: 1, limit: 50 };

      //Se simula que el caso de uso ListarJornadaUseCase.execute lanza una excepción inesperada
      mockListarJornadaUseCase.execute.mockRejectedValueOnce(new InternalServerErrorException('Fallo inesperado al consultar las jornadas.'));

      //Act & Assert: Se espera que el controlador propague la excepción como InternalServerErrorException
      await expect(controller.listarJornadas(queryParams)).rejects.toThrow(InternalServerErrorException);
    });
  });
});