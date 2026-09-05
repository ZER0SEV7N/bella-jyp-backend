//test/modules/RRHH/organizacion/area/area.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AreaController } from '@/modules/RRHH/organizacion/controller/area.controller';
import { CrearAreaUseCase } from '@/modules/RRHH/organizacion/use-cases/area/crearArea.useCase';
import { ActualizarAreaUseCase } from '@/modules/RRHH/organizacion/use-cases/area/actualizarArea.useCase';
import { EstadoAreaUseCase } from '@/modules/RRHH/organizacion/use-cases/area/estadoArea.useCase';
import { ListarAreasUseCase } from '@/modules/RRHH/organizacion/use-cases/area/listarAreas.useCase';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { ActualizarAreaDto, CrearAreaDto, ListarAreasQueryDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para el AreaController.
 * Se simulan los casos de éxito y manejo de excepciones para cada endpoint del controlador.
 * Se utilizan mocks para los casos de uso inyectados, permitiendo aislar la lógica del controlador.
 * Cada prueba valida que el controlador delega correctamente en los casos de uso y maneja las excepciones esperadas.
 */
describe('AreaController - Pruebas Unitarias Exhaustivas', () => {
  let controller: AreaController;

  //Mocks de los casos de uso inyectados en el controlador
  const mockCrearAreaUC = { execute: jest.fn() };
  const mockActualizarAreaUC = { execute: jest.fn() };
  const mockEstadoAreaUC = {
    desactivar: jest.fn(),
    reactivar: jest.fn() 
  };
  const mockListarAreasUC = { listar: jest.fn() };

  //UUID válido para pruebas de rutas que requieren un ID de área
  const idValido = '018f4a7c-7777-7000-1111-000000000001';

  //Configuración del módulo de pruebas antes de cada suite de pruebas
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AreaController],
      providers: [
        { provide: CrearAreaUseCase, useValue: mockCrearAreaUC },
        { provide: ActualizarAreaUseCase, useValue: mockActualizarAreaUC },
        { provide: EstadoAreaUseCase, useValue: mockEstadoAreaUC },
        { provide: ListarAreasUseCase, useValue: mockListarAreasUC }
      ]
    }).compile();

    controller = module.get<AreaController>(AreaController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('crear() - POST /api/rrhh/areas', () => {
    //Payload de prueba para crear un área
    const payload: CrearAreaDto = {
      nombre: 'Tecnología e Innovación',
      descripcion: 'Desarrollo de software y DevOps'
    };

    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe registrar exitosamente un área y retornar el nuevo registro con ID', async () => {
        //Arrange: Simular la respuesta del caso de uso para crear un área
        const respuestaEsperada = { id: idValido, ...payload, activo: true };
        mockCrearAreaUC.execute.mockResolvedValue(respuestaEsperada);

        //Act: Invocar el método del controlador para crear un área
        const result = await controller.crear(payload);

        //Assert: Verificar que el caso de uso fue llamado con el payload correcto y que la respuesta es la esperada
        expect(mockCrearAreaUC.execute).toHaveBeenCalledWith(payload);
        expect(result).toEqual(respuestaEsperada);
      });
    });

    describe('Manejo de Excepciones', () => {
      it('Debe propagar BadRequestException si el área se encuentra duplicada', async () => {
        //Arrange: Simular que el caso de uso lanza una excepción de solicitud incorrecta por duplicado
        mockCrearAreaUC.execute.mockRejectedValue(new BadRequestException({ title: 'Área Duplicada', detail: 'Ya existe el área' }));

        //Act & Assert: Verificar que el controlador propaga la excepción correctamente
        await expect(controller.crear(payload)).rejects.toThrow(BadRequestException);
        expect(mockCrearAreaUC.execute).toHaveBeenCalledWith(payload);
      });

      it('Debe propagar InternalServerErrorException ante fallos no controlados del caso de uso', async () => {
        //Arrange: Simular que el caso de uso lanza una excepción de error interno
        mockCrearAreaUC.execute.mockRejectedValue(new InternalServerErrorException('Error en base de datos'));

        //Act & Assert: Verificar que el controlador propaga la excepción correctamente
        await expect(controller.crear(payload)).rejects.toThrow(InternalServerErrorException);
      });
    });
  });

  describe('listar() - GET /api/rrhh/areas', () => {
    //Payload de prueba para listar áreas con paginación y filtrado
    const query: ListarAreasQueryDto = {
      page: 1,
      limit: 10,
      search: 'Tecnología',
      activo: true
    };

    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe delegar en ListarAreasUseCase y retornar lista paginada estructurada', async () => {
        //Arrange: Simular la respuesta del caso de uso para listar áreas
        const respuestaEsperada = {
          data: [{
            id: idValido,
            nombre: 'Tecnología',
            descripcion: 'TI',
            activo: true,
            total_cargos: 3,
            total_empleados: 12,
            total_jornadas: 1
          }],
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
        };

        //Simular la respuesta del caso de uso para listar áreas
        mockListarAreasUC.listar.mockResolvedValue(respuestaEsperada);

        //Act: Invocar el método del controlador para listar áreas
        const result = await controller.listarAreas(query);

        //Assert: Verificar que el caso de uso fue llamado con los parámetros correctos y que la respuesta es la esperada
        expect(mockListarAreasUC.listar).toHaveBeenCalledWith(query);
        expect(result).toEqual(respuestaEsperada);
      });
    });

    describe('Manejo de Excepciones', () => {
      it('Debe propagar InternalServerErrorException si la consulta de base de datos falla', async () => {
        //Arrange: Simular que el caso de uso lanza una excepción de error interno
        mockListarAreasUC.listar.mockRejectedValue(new InternalServerErrorException('Fallo en transacción'));

        //Act & Assert: Verificar que el controlador propaga la excepción correctamente
        await expect(controller.listarAreas(query)).rejects.toThrow(InternalServerErrorException);
      });
    });
  });

  describe('actualizar() - PUT /api/rrhh/areas/:id', () => {
    //Payload de prueba para actualizar un área
    const payload: ActualizarAreaDto = {
      nombre: 'Tecnología y Sistemas',
      descripcion: 'Actualización de alcance'
    };

    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe invocar ActualizarAreaUseCase con el ID y DTO correspondiente', async () => {
        //Arrange: Simular la respuesta del caso de uso para actualizar un área
        const respuestaEsperada = { id: idValido, ...payload, activo: true };
        mockActualizarAreaUC.execute.mockResolvedValue(respuestaEsperada);

        //Act: Invocar el método del controlador para actualizar un área
        const result = await controller.update(idValido, payload);

        //Assert: Verificar que el caso de uso fue llamado con los parámetros correctos y que la respuesta es la esperada
        expect(mockActualizarAreaUC.execute).toHaveBeenCalledWith(idValido, payload);
        expect(result).toEqual(respuestaEsperada);
      });
    });

    describe('Manejo de Excepciones', () => {
      it('Debe propagar NotFoundException si el área solicitada no existe', async () => {
        //Arrange: Simular que el caso de uso lanza una excepción de no encontrado
        mockActualizarAreaUC.execute.mockRejectedValue(new NotFoundException('Área no encontrada'));

        //Act & Assert: Verificar que el controlador propaga la excepción correctamente
        await expect(controller.update(idValido, payload)).rejects.toThrow(NotFoundException);
        expect(mockActualizarAreaUC.execute).toHaveBeenCalledWith(idValido, payload);
      });

      it('Debe propagar BadRequestException si el nuevo nombre colisiona con otra área', async () => {
        //Arrange: Simular que el caso de uso lanza una excepción de solicitud incorrecta por nombre duplicado
        mockActualizarAreaUC.execute.mockRejectedValue(new BadRequestException('Nombre duplicado'));

        //Act & Assert: Verificar que el controlador propaga la excepción correctamente
        await expect(controller.update(idValido, payload)).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('desactivar() - DELETE /api/rrhh/areas/:id/desactivar', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe ejecutar la desactivación lógica y retornar confirmación con activo=false', async () => {
        //Arrange: Simular la respuesta del caso de uso para desactivar un área
        const respuestaEsperada = { id: idValido, activo: false, deleted_at: new Date() };
        mockEstadoAreaUC.desactivar.mockResolvedValue(respuestaEsperada);

        //Act: Invocar el método del controlador para desactivar un área
        const result = await controller.eliminar(idValido);

        //Assert: Verificar que el caso de uso fue llamado con el ID correcto y que la respuesta es la esperada
        expect(mockEstadoAreaUC.desactivar).toHaveBeenCalledWith(idValido);
        expect(result.activo).toBe(false);
      });
    });

    describe('Manejo de Excepciones', () => {
      it('Debe propagar BadRequestException si el área posee empleados activos asociados', async () => {
        //Arrange: Simular que el caso de uso lanza una excepción de solicitud incorrecta por tener empleados activos
        mockEstadoAreaUC.desactivar.mockRejectedValue(new BadRequestException({ title: 'Área en Uso', detail: 'Tiene colaboradores asignados' }));

        //Act & Assert: Verificar que el controlador propaga la excepción correctamente
        await expect(controller.eliminar(idValido)).rejects.toThrow(BadRequestException);
      });

      it('Debe propagar BadRequestException si el área posee cargos activos vinculados', async () => {
        //Arrange: Simular que el caso de uso lanza una excepción de solicitud incorrecta por tener cargos activos
        mockEstadoAreaUC.desactivar.mockRejectedValue(new BadRequestException({ title: 'Área en Uso', detail: 'Tiene cargos activos' }));

        //Act & Assert: Verificar que el controlador propaga la excepción correctamente
        await expect(controller.eliminar(idValido)).rejects.toThrow(BadRequestException);
      });

      it('Debe propagar NotFoundException si el área no existe o ya está dada de baja', async () => {
        //Arrange: Simular que el caso de uso lanza una excepción de no encontrado
        mockEstadoAreaUC.desactivar.mockRejectedValue(new NotFoundException('Área inexistente'));

        //Act & Assert: Verificar que el controlador propaga la excepción correctamente
        await expect(controller.eliminar(idValido)).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('reactivar() - PATCH /api/rrhh/areas/:id/reactivar', () => {
    describe('Casos de Éxito (Happy Path)', () => {
      it('Debe reactivar el área y retornar el registro con activo=true y deleted_at=null', async () => {
        //Arrange: Simular la respuesta del caso de uso para reactivar un área
        const respuestaEsperada = { id: idValido, activo: true, deleted_at: null };
        mockEstadoAreaUC.reactivar.mockResolvedValue(respuestaEsperada);

        //Act: Invocar el método del controlador para reactivar un área
        const result = await controller.reactive(idValido);

        //Assert: Verificar que el caso de uso fue llamado con el ID correcto y que la respuesta es la esperada
        expect(mockEstadoAreaUC.reactivar).toHaveBeenCalledWith(idValido);
        expect(result.activo).toBe(true);
      });
    });

    describe('Manejo de Excepciones', () => {
      it('Debe propagar BadRequestException si el área ya se encuentra activa', async () => {
        //Arrange: Simular que el caso de uso lanza una excepción de solicitud incorrecta por estar ya activa
        mockEstadoAreaUC.reactivar.mockRejectedValue(new BadRequestException('El área ya está activa'));

        //Act & Assert: Verificar que el controlador propaga la excepción correctamente
        await expect(controller.reactive(idValido)).rejects.toThrow(BadRequestException);
      });

      it('Debe propagar NotFoundException si el área a reactivar no existe', async () => {
        //Arrange: Simular que el caso de uso lanza una excepción de no encontrado
        mockEstadoAreaUC.reactivar.mockRejectedValue(new NotFoundException('Área no encontrada'));

        //Act & Assert: Verificar que el controlador propaga la excepción correctamente
        await expect(controller.reactive(idValido)).rejects.toThrow(NotFoundException);
      });
    });
  });
});