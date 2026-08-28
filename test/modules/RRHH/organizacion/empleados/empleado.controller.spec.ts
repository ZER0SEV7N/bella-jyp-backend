//test/modules/RRHH/empleados/empleado.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException} from '@nestjs/common';
import { EmpleadoController } from '@/modules/RRHH/organizacion/controller/empleado.controller';
import { CrearEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/crearEmpleado.useCase';
import { EditarEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/editarEmpleado.useCase';
import { EliminarEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/eliminarEmpleado.useCase';
import { ActiveEmpleadoUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/activeEmpleado.useCase';
import { ListarEmpleadosUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/listarEmpleados.useCase';

/**
 * Pruebas unitarias para el EmpleadoController.
 * Se utilizan mocks para todos los casos de uso inyectados en el controlador, permitiendo simular diferentes escenarios sin depender de la implementación real.
 * Se verifican los endpoints de creación, edición, eliminación, 
 * reactivación y listado de empleados, incluyendo el manejo de excepciones como BadRequestException y NotFoundException.
 * Se asegura que el controlador interactúe correctamente con los casos de uso y maneje las respuestas y errores de manera adecuada.
 * Se utilizan las funciones de Jest para espiar y simular el comportamiento de los casos de uso,
 * permitiendo verificar que se llamen con los parámetros correctos y que se manejen los resultados esperados.
 */
describe('EmpleadoController', () => {
  let controller: EmpleadoController;

  //Mocks de todos los casos de uso
  const mockCrearEmpleadoUC = { execute: jest.fn() };
  const mockEditarEmpleadoUC = { execute: jest.fn() };
  const mockEliminarEmpleadoUC = { execute: jest.fn() };
  const mockActiveEmpleadoUC = { execute: jest.fn() };
  const mockListarEmpleadosUC = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmpleadoController],
      providers: [
        { provide: CrearEmpleadoUseCase, useValue: mockCrearEmpleadoUC },
        { provide: EditarEmpleadoUseCase, useValue: mockEditarEmpleadoUC },
        { provide: EliminarEmpleadoUseCase, useValue: mockEliminarEmpleadoUC },
        { provide: ActiveEmpleadoUseCase, useValue: mockActiveEmpleadoUC },
        { provide: ListarEmpleadosUseCase, useValue: mockListarEmpleadosUC },
      ],
    }).compile();

    controller = module.get<EmpleadoController>(EmpleadoController);
  });

  afterEach(() => jest.clearAllMocks());

  //=========================================================================
  //ENDPOINT: CREAR EMPLEADO
  //=========================================================================
  describe('crear()', () => {
    it('Debería llamar a CrearEmpleadoUseCase y retornar el nuevo empleado', async () => {
      const payload = { nro_documento: '70112233', nombre: 'Juan' } as any;
      mockCrearEmpleadoUC.execute.mockResolvedValue({id: 'uuid-123', ...payload});

      const result = await controller.crear(payload);

      expect(result.id).toBe('uuid-123');
      expect(mockCrearEmpleadoUC.execute).toHaveBeenCalledWith(payload);
    });

    it('Debería relanzar BadRequestException si el caso de uso falla (Ej. Documento duplicado)', async () => {
      const payload = { nro_documento: '70112233' } as any;
      mockCrearEmpleadoUC.execute.mockRejectedValue(new BadRequestException('Documento Duplicado'));

      await expect(controller.crear(payload)).rejects.toThrow(BadRequestException);
      expect(mockCrearEmpleadoUC.execute).toHaveBeenCalledWith(payload);
    });
  });

  //=========================================================================
  //ENDPOINT: LISTAR EMPLEADOS
  //=========================================================================
  describe('obtenerTodos()', () => {
    it('Debería llamar a ListarEmpleadosUseCase y retornar la paginación', async () => {
      const query = { page: 1, limit: 10, activo: true };
      mockListarEmpleadosUC.execute.mockResolvedValue({
        data: [],
        meta: { total: 0 }
      });

      const result = await controller.obtenerTodos(query);

      expect(result.meta).toBeDefined();
      expect(mockListarEmpleadosUC.execute).toHaveBeenCalledWith(query);
    });

    it('Debería relanzar un error si la BD falla al intentar listar', async () => {
      const query = { page: 1, limit: 10 };
      mockListarEmpleadosUC.execute.mockRejectedValue(new InternalServerErrorException('Fallo de DB'));

      await expect(controller.obtenerTodos(query)).rejects.toThrow(InternalServerErrorException);
    });
  });

  //=========================================================================
  //ENDPOINT: ACTUALIZAR EMPLEADO
  //=========================================================================
  describe('actualizarEmpleado()', () => {
    it('Debería llamar a EditarEmpleadoUseCase y retornar el empleado actualizado', async () => {
      const id = 'uuid-123';
      const payload = { nombre: 'Juan Editado' } as any;
      mockEditarEmpleadoUC.execute.mockResolvedValue({ id, ...payload });

      const result = await controller.actualizarEmpleado(id, payload);

      expect(result.nombre).toBe('Juan Editado');
      expect(mockEditarEmpleadoUC.execute).toHaveBeenCalledWith(id, payload);
    });

    it('Debería relanzar NotFoundException si el empleado a editar no existe', async () => {
      const id = 'uuid-404';
      const payload = { nombre: 'Juan Editado' } as any;
      mockEditarEmpleadoUC.execute.mockRejectedValue(new NotFoundException('Colaborador no encontrado'));

      await expect(controller.actualizarEmpleado(id, payload)).rejects.toThrow(NotFoundException);
    });

    it('Debería relanzar BadRequestException si la edición viola una regla (Ej. choca DNI)', async () => {
      const id = 'uuid-123';
      const payload = { nro_documento: '99999999' } as any;
      mockEditarEmpleadoUC.execute.mockRejectedValue(new BadRequestException('DNI en uso'));

      await expect(controller.actualizarEmpleado(id, payload)).rejects.toThrow(BadRequestException);
    });
  });

  //=========================================================================
  //ENDPOINT: ELIMINAR (SOFT DELETE) EMPLEADO
  //=========================================================================
  describe('deletedEmpleado()', () => {
    it('Debería llamar a EliminarEmpleadoUseCase y retornar el estado', async () => {
      const id = 'uuid-123';
      mockEliminarEmpleadoUC.execute.mockResolvedValue({
        activo: false,
        fecha_cese: new Date()
      });

      const result = await controller.deletedEmpleado(id);

      expect(result.activo).toBe(false);
      expect(mockEliminarEmpleadoUC.execute).toHaveBeenCalledWith(id);
    });

    it('Debería relanzar NotFoundException si se intenta eliminar un empleado que no existe', async () => {
      const id = 'uuid-404';
      mockEliminarEmpleadoUC.execute.mockRejectedValue(new NotFoundException('No encontrado'));

      await expect(controller.deletedEmpleado(id)).rejects.toThrow(NotFoundException);
    });
  });

  //=========================================================================
  //ENDPOINT: REACTIVAR EMPLEADO
  //=========================================================================
  describe('reactive()', () => {
    it('Debería llamar a ActiveEmpleadoUseCase y retornar el estado', async () => {
      const id = 'uuid-123';
      mockActiveEmpleadoUC.execute.mockResolvedValue({
        state: true,
        message: 'Reactivado'
      });

      const result = await controller.reactive(id);

      expect(result.state).toBe(true);
      expect(mockActiveEmpleadoUC.execute).toHaveBeenCalledWith(id);
    });

    it('Debería relanzar BadRequestException si el UseCase falla (Ej. Zod parse adentro del UseCase)', async () => {
      const invalidId = 'not-a-uuid';
      mockActiveEmpleadoUC.execute.mockRejectedValue(new BadRequestException('Error al reactivar'));

      await expect(controller.reactive(invalidId)).rejects.toThrow(BadRequestException);
      expect(mockActiveEmpleadoUC.execute).toHaveBeenCalledWith(invalidId);
    });
  });
});
