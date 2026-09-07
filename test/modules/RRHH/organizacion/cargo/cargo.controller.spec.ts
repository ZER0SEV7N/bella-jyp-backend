//test/modules/RRHH/organizacion/cargo/cargo.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException} from '@nestjs/common';
import { CargoController } from '@/modules/RRHH/organizacion/controller/cargo.controller';
import { CrearCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/crearCargo.useCase';
import { ActualizarCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/actualizarCargo.useCase';
import { EstadoCargoUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/estadoCargo.useCase';
import { ListarCargosUseCase } from '@/modules/RRHH/organizacion/use-cases/cargos/listarCargos.useCase';
import type {
  CrearCargoDto,
  ActualizarCargoDto,
  ListarCargosQueryDto,
} from '@jyp/shared-contracts';

/** 
 * Pruebas unitarias exhaustivas para el controlador de cargos.
 * Se simula el comportamiento de los casos de uso para verificar la lógica de negocio y las excepciones lanzadas en diferentes escenarios.
 * Se incluyen pruebas para la creación, actualización, desactivación, reactivación y listado de cargos con bandas salariales.
 */
describe('CargoController - Pruebas Unitarias Exhaustivas de Endpoints HTTP', () => {
  let controller: CargoController;

  //Mockear los casos de uso para simular la interacción con la base de datos y la lógica de negocio
  const mockCrearCargoUseCase = { execute: jest.fn() };
  const mockActualizarCargoUseCase = { execute: jest.fn() };
  const mockEstadoCargoUseCase = { desactivar: jest.fn(), reactivar: jest.fn() };
  const mockListarCargosUseCase = { listar: jest.fn() };

  //Mockear IDs de prueba para cargos y áreas
  const mockCargoId = '018f4a7c-8888-7000-2222-000000000001';
  const mockAreaId = '018f4a7c-7777-7000-1111-000000000001';

  //Configuración del módulo de pruebas antes de cada test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CargoController],
      providers: [
        { provide: CrearCargoUseCase, useValue: mockCrearCargoUseCase },
        { provide: ActualizarCargoUseCase, useValue: mockActualizarCargoUseCase },
        { provide: EstadoCargoUseCase, useValue: mockEstadoCargoUseCase },
        { provide: ListarCargosUseCase, useValue: mockListarCargosUseCase }
      ]
    }).compile();

    controller = module.get<CargoController>(CargoController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('POST /api/rrhh/cargo/crear - crear()', () => {
    //Payload de prueba para crear un cargo
    const payload: CrearCargoDto = {
      id_area: mockAreaId,
      nombre: 'Analista de Nóminas Senior',
      descripcion: 'Responsable de planillas y fiscalización PLAME',
      sueldo_minimo: 1800.0,
      sueldo_maximo: 3800.0,
    };

    it('Happy Path: Debe crear exitosamente un cargo y retornar el objeto creado con bandas salariales y área', async () => {
      //Arrange: Simular que el caso de uso de creación retorna un cargo válido
      const mockCreatedCargo = {
        id: mockCargoId,
        ...payload,
        activo: true,
        deleted_at: null,
        area: { id: mockAreaId, nombre: 'Recursos Humanos' },
      };

      //Simular que el caso de uso de creación retorna un cargo válido
      mockCrearCargoUseCase.execute.mockResolvedValueOnce(mockCreatedCargo);

      //Act: Llamar al método del controlador para crear el cargo
      const result = await controller.crear(payload);

      //Assert: Verificar que el caso de uso se haya llamado con el payload correcto y que el resultado sea el cargo creado
      expect(mockCrearCargoUseCase.execute).toHaveBeenCalledWith(payload);
      expect(result).toEqual(mockCreatedCargo);
    });

    it('Excepción / Negocio: Debe propagar BadRequestException si el nombre del cargo ya existe en el área', async () => {
      //Arrange: Simular que el caso de uso de creación lanza BadRequestException por nombre duplicado
      mockCrearCargoUseCase.execute.mockRejectedValueOnce(new BadRequestException({
        title: 'Cargo duplicado',
        detail: `Ya existe un cargo llamado '${payload.nombre}' dentro de esta área.`
      }));

      //Act & Assert: Llamar al método del controlador y verificar que se lance la excepción
      await expect(controller.crear(payload)).rejects.toThrow(BadRequestException);
      expect(mockCrearCargoUseCase.execute).toHaveBeenCalledWith(payload);
    });

    it('Excepción / Integridad: Debe propagar NotFoundException si el área especificada no existe o se encuentra inactiva', async () => {
      //Arrange: Simular que el caso de uso de creación lanza NotFoundException por área inexistente
      mockCrearCargoUseCase.execute.mockRejectedValueOnce(new NotFoundException({
        title: 'Área inválida',
        detail: 'El área especificada no existe o se encuentra inactiva/eliminada.'
      }));

      //Act & Assert: Llamar al método del controlador y verificar que se lance la excepción
      await expect(controller.crear(payload)).rejects.toThrow(NotFoundException);
      expect(mockCrearCargoUseCase.execute).toHaveBeenCalledWith(payload);
    });

    it('Excepción / Resiliencia: Debe propagar InternalServerErrorException en caso de fallo crítico en base de datos', async () => {
      //Arrange: Simular que el caso de uso de creación lanza InternalServerErrorException por fallo en la base de datos
      mockCrearCargoUseCase.execute.mockRejectedValueOnce(new InternalServerErrorException({
        title: 'Error al crear el Cargo',
        detail: 'Fallo de conexión en PostgreSQL.'
      }));

      //Act & Assert: Llamar al método del controlador y verificar que se lance la excepción
      await expect(controller.crear(payload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('PUT /api/rrhh/cargo/:id/actualizar - update()', () => {
    //Payload de prueba para actualizar un cargo
    const payload: ActualizarCargoDto = {
      nombre: 'Especialista de Compensaciones',
      descripcion: 'Actualización de responsabilidades',
      sueldo_minimo: 2200.0,
      sueldo_maximo: 4200.0
    };

    it('Happy Path: Debe actualizar los atributos del cargo y retornar el registro actualizado', async () => {
      //Arrange: Simular que el caso de uso de actualización retorna un cargo actualizado
      const mockUpdatedCargo = {
        id: mockCargoId,
        id_area: mockAreaId,
        ...payload,
        activo: true,
        deleted_at: null
      };

      //Simular que el caso de uso de actualización retorna un cargo actualizado
      mockActualizarCargoUseCase.execute.mockResolvedValueOnce(mockUpdatedCargo);

      //Act: Llamar al método del controlador para actualizar el cargo
      const result = await controller.update(mockCargoId, payload);

      //Assert: Verificar que el caso de uso se haya llamado con el ID y payload correctos y que el resultado sea el cargo actualizado
      expect(mockActualizarCargoUseCase.execute).toHaveBeenCalledWith(mockCargoId, payload);
      expect(result).toEqual(mockUpdatedCargo);
    });

    it('Excepción: Debe propagar NotFoundException si el cargo a actualizar no existe o fue dado de baja', async () => {
      //Arrange: Simular que el caso de uso de actualización lanza NotFoundException por cargo inexistente
      mockActualizarCargoUseCase.execute.mockRejectedValueOnce(new NotFoundException({
        title: 'Cargo no encontrado',
        detail: 'El cargo que intenta actualizar no existe o ha sido eliminado.'
      }));

      //Act & Assert: Llamar al método del controlador y verificar que se lance la excepción
      await expect(controller.update(mockCargoId, payload)).rejects.toThrow(NotFoundException);
    });

    it('Excepción / Negocio: Debe propagar BadRequestException si el área destino está inactiva o la banda es inconsistente', async () => {
      //Arrange: Simular que el caso de uso de actualización lanza BadRequestException por banda salarial inconsistente
      mockActualizarCargoUseCase.execute.mockRejectedValueOnce(new BadRequestException({
        title: 'Banda Salarial Inconsistente',
        detail: 'El sueldo máximo no puede ser menor al sueldo mínimo.'
      }));
    
      //Act & Assert: Llamar al método del controlador y verificar que se lance la excepción
      await expect(controller.update(mockCargoId, payload)).rejects.toThrow(BadRequestException);
    });

    it('Excepción / Resiliencia: Debe propagar InternalServerErrorException si la base de datos falla al actualizar', async () => {
      //Arrange: Simular que el caso de uso de actualización lanza InternalServerErrorException por fallo en la base de datos
      mockActualizarCargoUseCase.execute.mockRejectedValueOnce(new InternalServerErrorException('Fallo interno al actualizar el cargo.'));

      //Act & Assert: Llamar al método del controlador y verificar que se lance la excepción
      await expect(controller.update(mockCargoId, payload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('DELETE /api/rrhh/cargo/:id/desactive - eliminar()', () => {
    it('Happy Path: Debe desactivar el cargo aplicando Soft Delete y retornar el registro con activo=false', async () => {
      //Arrange: Simular que el caso de uso de desactivación retorna un cargo desactivado
      const mockDesactivado = {
        id: mockCargoId,
        nombre: 'Asistente de Oficina',
        activo: false,
        deleted_at: new Date()
      };

      //Simular que el caso de uso de desactivación retorna un cargo desactivado
      mockEstadoCargoUseCase.desactivar.mockResolvedValueOnce(mockDesactivado);

      //Act: Llamar al método del controlador para desactivar el cargo
      const result = await controller.eliminar(mockCargoId);

      //Assert: Verificar que el caso de uso se haya llamado con el ID correcto y que el resultado sea el cargo desactivado
      expect(mockEstadoCargoUseCase.desactivar).toHaveBeenCalledWith(mockCargoId);
      expect(result).toEqual(mockDesactivado);
      expect(result.activo).toBe(false);
    });

    it('Regla de Negocio: Debe propagar BadRequestException si existen empleados activos ocupando el cargo', async () => {
      //Arrange: Simular que el caso de uso de desactivación lanza BadRequestException por empleados activos
      mockEstadoCargoUseCase.desactivar.mockRejectedValueOnce(new BadRequestException({
        title: 'Eliminación bloqueada',
        detail: 'Este cargo está siendo ocupado por 3 empleado(s) activo(s). Debe reasignarlos antes de desactivarlo.'
      }));

      //Act & Assert: Llamar al método del controlador y verificar que se lance la excepción
      await expect(controller.eliminar(mockCargoId)).rejects.toThrow(BadRequestException);
      expect(mockEstadoCargoUseCase.desactivar).toHaveBeenCalledWith(mockCargoId);
    });

    it('Excepción: Debe propagar NotFoundException si el cargo no existe o ya fue eliminado', async () => {
      //Arrange: Simular que el caso de uso de desactivación lanza NotFoundException por cargo inexistente
      mockEstadoCargoUseCase.desactivar.mockRejectedValueOnce(new NotFoundException({
          title: 'Cargo no encontrado',
          detail: 'El cargo especificado no existe o ya se encuentra eliminado.'
      }));

      //Act & Assert: Llamar al método del controlador y verificar que se lance la excepción
      await expect(controller.eliminar(mockCargoId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('PATCH /api/rrhh/cargo/:id/reactive - reactive()', () => {
    it('Happy Path: Debe reactivar el cargo restableciendo activo=true y deleted_at=null', async () => {
      //Arrange: Simular que el caso de uso de reactivación retorna un cargo reactivado
      const mockReactivado = {
        id: mockCargoId,
        nombre: 'Supervisor de Seguridad',
        activo: true,
        deleted_at: null,
        area: { id: mockAreaId, nombre: 'Seguridad' }
      };

      //Simular que el caso de uso de reactivación retorna un cargo reactivado
      mockEstadoCargoUseCase.reactivar.mockResolvedValueOnce(mockReactivado);

      //Act: Llamar al método del controlador para reactivar el cargo
      const result = await controller.reactive(mockCargoId);

      //Assert: Verificar que el caso de uso se haya llamado con el ID correcto y que el resultado sea el cargo reactivado
      expect(mockEstadoCargoUseCase.reactivar).toHaveBeenCalledWith(mockCargoId);
      expect(result).toEqual(mockReactivado);
      expect(result.activo).toBe(true);
      expect(result.deleted_at).toBeNull();
    });

    it('Excepción: Debe propagar NotFoundException si el cargo a reactivar no existe en BD', async () => {
      //Arrange: Simular que el caso de uso de reactivación lanza NotFoundException por cargo inexistente
      mockEstadoCargoUseCase.reactivar.mockRejectedValueOnce(new NotFoundException({
        title: 'Cargo no encontrado',
        detail: 'El cargo especificado no existe.',
      }));

      //Act & Assert: Llamar al método del controlador y verificar que se lance la excepción
      await expect(controller.reactive(mockCargoId)).rejects.toThrow(NotFoundException);
    });

    it('Excepción / Negocio: Debe propagar BadRequestException si el área a la que pertenece el cargo está inactiva', async () => {
      //Arrange: Simular que el caso de uso de reactivación lanza BadRequestException por área inactiva
      mockEstadoCargoUseCase.reactivar.mockRejectedValueOnce(new BadRequestException({
        title: 'Área inactiva',
        detail: 'No se puede reactivar el cargo porque el área a la que pertenece está inactiva o eliminada.'
      }));

      //Act & Assert: Llamar al método del controlador y verificar que se lance la excepción
      await expect(controller.reactive(mockCargoId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /api/rrhh/cargo - listarCargos()', () => {
    it('Happy Path: Debe listar cargos paginados aplicando filtros por búsqueda, área y estado activo', async () => {
      //Arrange: Definir parámetros de consulta y simular la respuesta del caso de uso de listado
      const queryParams: ListarCargosQueryDto = {
        page: 1,
        limit: 10,
        search: 'Contable',
        id_area: mockAreaId,
        activo: true
      };

      //Simular la respuesta del caso de uso de listado con un cargo que cumple los filtros
      const mockResponse = {
        data: [{
            id: mockCargoId,
            nombre: 'Analista Contable',
            id_area: mockAreaId,
            sueldo_minimo: 1500.0,
            sueldo_maximo: 3200.0,
            activo: true,
            area: { id: mockAreaId, nombre: 'Contabilidad' },
            total_empleados: 2
          }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
      };

      mockListarCargosUseCase.listar.mockResolvedValueOnce(mockResponse);

      //Act: Llamar al método del controlador para listar los cargos con los parámetros de consulta
      const result = await controller.listarCargos(queryParams);

      //Assert: Verificar que el caso de uso se haya llamado con los parámetros correctos y que el resultado sea la respuesta simulada
      expect(mockListarCargosUseCase.listar).toHaveBeenCalledWith(queryParams);
      expect(result).toEqual(mockResponse);
      expect(result.data).toHaveLength(1);
    });

    it('Excepción / Resiliencia: Debe propagar InternalServerErrorException si la consulta transaccional falla', async () => {
      //Arrange: Definir parámetros de consulta y simular que el caso de uso de listado lanza InternalServerErrorException
      const queryParams: ListarCargosQueryDto = { page: 1, limit: 50 };

      //Simular que el caso de uso de listado lanza InternalServerErrorException por fallo en la base de datos
      mockListarCargosUseCase.listar.mockRejectedValueOnce(new InternalServerErrorException({
        title: 'Error al listar cargos',
        detail: 'Fallo al consultar los cargos.'
      }));

      //Act & Assert: Llamar al método del controlador y verificar que se lance la excepción
      await expect(controller.listarCargos(queryParams)).rejects.toThrow(InternalServerErrorException);
    });
  });
});