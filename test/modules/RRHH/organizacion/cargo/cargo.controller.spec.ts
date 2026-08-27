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
 * Se incluyen pruebas para la creación, actualización, desactivación, reactivación y listado de cargos, 
 * cubriendo casos felices, reglas de negocio y errores esperados.
 */
describe('CargoController - Pruebas Unitarias Exhaustivas de Endpoints HTTP', () => {
    let controller: CargoController;

    //Mockear todo lo relacionado con los casos de uso para aislar el controlador y probar su comportamiento
    const mockCrearCargoUseCase = {execute: jest.fn()};
    const mockActualizarCargoUseCase = {execute: jest.fn()};
    const mockEstadoCargoUseCase = {desactivar: jest.fn(), reactivar: jest.fn()};
    const mockListarCargosUseCase = {listar: jest.fn(),};
    //Mockear UUIDs para pruebas consistentes y predecibles
    const mockCargoId = '018f4a7c-8888-7000-2222-000000000001';
    const mockAreaId = '018f4a7c-7777-7000-1111-000000000001';
    const mockJornadaId = '018f4a7c-6666-7000-f000-000000000001';

    //Configuración inicial antes de cada prueba
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
        //Payload de prueba para crear un cargo, incluyendo área y jornada sugerida
        const payload: CrearCargoDto = {
            id_area: mockAreaId,
            nombre: 'Analista de Nóminas Senior',
            descripcion: 'Responsable de planillas y fiscalización PLAME',
            jornada_sugerida_id: mockJornadaId
        };

        it('Happy Path: Debe crear exitosamente un cargo y retornar el objeto creado con relaciones', async () => {
            //Arrange: Simular la respuesta de la use case para crear un cargo
            const mockCreatedCargo = {
                id: mockCargoId,
                ...payload,
                activo: true,
                deleted_at: null,
                area: { id: mockAreaId, nombre: 'Recursos Humanos' },
                jornada_sugerida: {
                    id: mockJornadaId,
                    nombre: 'Turno Mañana (Oficina)',
                    tipo_jornada: 'FIJA'
                }
            };

            //Simular que la use case retorna el cargo creado
            mockCrearCargoUseCase.execute.mockResolvedValueOnce(mockCreatedCargo);

            //Act: Ejecutar el método del controlador para crear un cargo
            const result = await controller.crear(payload);

            //Assert: Verificar que la use case fue llamada con el payload correcto y que el resultado es el esperado
            expect(mockCrearCargoUseCase.execute).toHaveBeenCalledWith(payload);
            expect(result).toEqual(mockCreatedCargo);
        });

        it('Excepción / Negocio: Debe propagar BadRequestException si el nombre del cargo ya existe en el área', async () => {
            //Simular que la use case lanza una excepción de negocio por duplicidad de nombre
            mockCrearCargoUseCase.execute.mockRejectedValueOnce(new BadRequestException({
                title: 'Cargo duplicado',
                detail: `Ya existe un cargo llamado '${payload.nombre}' dentro de esta área.`
            }));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.crear(payload)).rejects.toThrow(BadRequestException);
            expect(mockCrearCargoUseCase.execute).toHaveBeenCalledWith(payload);
        });

        it('Excepción / Integridad: Debe propagar NotFoundException si el área o la jornada sugerida no existen o están inactivas', async () => {
            //Simular que la use case lanza una excepción de integridad por área inexistente o inactiva
            mockCrearCargoUseCase.execute.mockRejectedValueOnce(new NotFoundException({
                title: 'Área inválida',
                detail: 'El área especificada no existe o se encuentra inactiva/eliminada.',
            }));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.crear(payload)).rejects.toThrow(NotFoundException);
            expect(mockCrearCargoUseCase.execute).toHaveBeenCalledWith(payload);
        });

        it('Excepción / Resiliencia: Debe propagar InternalServerErrorException en caso de fallo crítico en el motor de base de datos', async () => {
            //Simular que la use case lanza una excepción de resiliencia por fallo crítico en la base de datos
            mockCrearCargoUseCase.execute.mockRejectedValueOnce(new InternalServerErrorException({
                title: 'Error al crear el Cargo',
                detail: 'Fallo de conexión en PostgreSQL.',
            }));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.crear(payload)).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('PUT /api/rrhh/cargo/:id/actualizar - update()', () => {
        //Payload de prueba para actualizar un cargo, 
        //incluyendo cambio de nombre, descripción y jornada sugerida
        const payload: ActualizarCargoDto = {
            nombre: 'Especialista de Compensaciones',
            descripcion: 'Actualización de responsabilidades',
            jornada_sugerida_id: mockJornadaId
        };

        it('Happy Path: Debe actualizar los atributos del cargo y retornar el registro actualizado', async () => {
            //Arrange: Simular la respuesta de la use case para actualizar un cargo
            const mockUpdatedCargo = {
                id: mockCargoId,
                id_area: mockAreaId,
                ...payload,
                activo: true,
                deleted_at: null,
            };

            //Simular que la use case retorna el cargo actualizado
            mockActualizarCargoUseCase.execute.mockResolvedValueOnce(mockUpdatedCargo);

            //Act: Ejecutar el método del controlador para actualizar un cargo
            const result = await controller.update(mockCargoId, payload);

            //Assert: Verificar que la use case fue llamada con el ID y payload correctos y que el resultado es el esperado
            expect(mockActualizarCargoUseCase.execute).toHaveBeenCalledWith(mockCargoId, payload);
            expect(result).toEqual(mockUpdatedCargo);
        });

        it('Happy Path: Debe permitir desvincular la jornada sugerida enviando null', async () => {
            //Arrange: Simular la respuesta de la use case para actualizar un cargo sin jornada sugerida
            const payloadSinJornada: ActualizarCargoDto = {jornada_sugerida_id: null};
            const mockCargoSinJornada = {
                id: mockCargoId,
                id_area: mockAreaId,
                nombre: 'Analista',
                jornada_sugerida_id: null
            };

            //Simular que la use case retorna el cargo actualizado sin jornada sugerida
            mockActualizarCargoUseCase.execute.mockResolvedValueOnce(mockCargoSinJornada);

            //Act: Ejecutar el método del controlador para actualizar un cargo sin jornada sugerida
            const result = await controller.update(mockCargoId, payloadSinJornada);

            //Assert: Verificar que la use case fue llamada con el ID y payload correctos y que el resultado es el esperado
            expect(mockActualizarCargoUseCase.execute).toHaveBeenCalledWith(mockCargoId, payloadSinJornada);
            expect(result.jornada_sugerida_id).toBeNull();
        });

        it('Excepción: Debe propagar NotFoundException si el cargo a actualizar no existe o fue dado de baja', async () => {
            //Simular que la use case lanza una excepción de negocio por cargo inexistente o eliminado
            mockActualizarCargoUseCase.execute.mockRejectedValueOnce(new NotFoundException({
                title: 'Cargo no encontrado',
                detail: 'El cargo que intenta actualizar no existe o ha sido eliminado.'
            }));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.update(mockCargoId, payload)).rejects.toThrow(NotFoundException);   
        });

        it('Excepción / Negocio: Debe propagar BadRequestException si el área destino está inactiva o el nombre colisiona', async () => {
            //Simular que la use case lanza una excepción de negocio por área inactiva o nombre duplicado
            mockActualizarCargoUseCase.execute.mockRejectedValueOnce(new BadRequestException({
                title: 'Nombre de cargo duplicado',
                detail: 'Ya existe otro cargo con ese nombre en el área destino.',
            }));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.update(mockCargoId, payload)).rejects.toThrow(BadRequestException);
        });

        it('Excepción / Resiliencia: Debe propagar InternalServerErrorException si la base de datos falla al actualizar', async () => {
            //Simular que la use case lanza una excepción de resiliencia por fallo crítico en la base de datos
            mockActualizarCargoUseCase.execute.mockRejectedValueOnce(new InternalServerErrorException('Fallo interno al actualizar el cargo.'));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.update(mockCargoId, payload)).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('DELETE /api/rrhh/cargo/:id/desactive - eliminar()', () => {
        it('Happy Path: Debe desactivar el cargo aplicando Soft Delete y retornar el registro con activo=false', async () => {
            //Arrange: Simular la respuesta de la use case para desactivar un cargo
            const mockDesactivado = {
                id: mockCargoId,
                nombre: 'Asistente de Oficina',
                activo: false,
                deleted_at: new Date(),
            };

            //Simular que la use case retorna el cargo desactivado
            mockEstadoCargoUseCase.desactivar.mockResolvedValueOnce(mockDesactivado);

            //Act: Ejecutar el método del controlador para desactivar un cargo
            const result = await controller.eliminar(mockCargoId);

            //Assert: Verificar que la use case fue llamada con el ID correcto y que el resultado es el esperado
            expect(mockEstadoCargoUseCase.desactivar).toHaveBeenCalledWith(mockCargoId);
            expect(result).toEqual(mockDesactivado);
            expect(result.activo).toBe(false);
        });

        it('Regla de Negocio: Debe propagar BadRequestException si existen empleados activos ocupando el cargo', async () => {
            //Simular que la use case lanza una excepción de negocio por tener empleados activos asignados al cargo
            mockEstadoCargoUseCase.desactivar.mockRejectedValueOnce(new BadRequestException({
                title: 'Eliminación bloqueada',
                detail: 'Este cargo está siendo ocupado por 3 empleado(s) activo(s). Debe reasignarlos antes de desactivarlo.',
            }));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.eliminar(mockCargoId)).rejects.toThrow(BadRequestException);
            expect(mockEstadoCargoUseCase.desactivar).toHaveBeenCalledWith(mockCargoId);
        });

        it('Excepción: Debe propagar NotFoundException si el cargo no existe o ya fue eliminado', async () => {
            //Simular que la use case lanza una excepción de negocio por cargo inexistente o eliminado
            mockEstadoCargoUseCase.desactivar.mockRejectedValueOnce(new NotFoundException({
                title: 'Cargo no encontrado',
                detail: 'El cargo especificado no existe o ya se encuentra eliminado.'
            }));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.eliminar(mockCargoId)).rejects.toThrow(NotFoundException);
        });

        it('Excepción / Resiliencia: Debe propagar InternalServerErrorException en caso de error no previsto', async () => {
            //Simular que la use case lanza una excepción de servidor interno
            mockEstadoCargoUseCase.desactivar.mockRejectedValueOnce(new InternalServerErrorException('Error al desactivar el cargo.'));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.eliminar(mockCargoId)).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('PATCH /api/rrhh/cargo/:id/reactive - reactive()', () => {
        it('Happy Path: Debe reactivar el cargo restableciendo activo=true y deleted_at=null', async () => {
           //Arrange: Simular la respuesta de la use case para reactivar un cargo
            const mockReactivado = {
                id: mockCargoId,
                nombre: 'Supervisor de Seguridad',
                activo: true,
                deleted_at: null,
                area: { id: mockAreaId, nombre: 'Seguridad' }
            };

            //Simular que la use case retorna el cargo reactivado
            mockEstadoCargoUseCase.reactivar.mockResolvedValueOnce(mockReactivado);

            //Act: Ejecutar el método del controlador para reactivar un cargo
            const result = await controller.reactive(mockCargoId);

            //Assert: Verificar que la use case fue llamada con el ID correcto y que el resultado es el esperado
            expect(mockEstadoCargoUseCase.reactivar).toHaveBeenCalledWith(mockCargoId);
            expect(result).toEqual(mockReactivado);
            expect(result.activo).toBe(true);
            expect(result.deleted_at).toBeNull();
        });

        it('Excepción: Debe propagar NotFoundException si el cargo a reactivar no existe en BD', async () => {
            //Simular que la use case lanza una excepción de negocio por cargo inexistente
            mockEstadoCargoUseCase.reactivar.mockRejectedValueOnce(new NotFoundException({
                title: 'Cargo no encontrado',
                detail: 'El cargo especificado no existe.',
            }));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.reactive(mockCargoId)).rejects.toThrow(NotFoundException);
        });

        it('Excepción / Resiliencia: Debe propagar InternalServerErrorException si la restauración falla en BD', async () => {
            //Simular que la use case lanza una excepción de servidor interno al intentar reactivar el cargo
            mockEstadoCargoUseCase.reactivar.mockRejectedValueOnce(new InternalServerErrorException('Fallo inesperado al restaurar el cargo.'));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.reactive(mockCargoId)).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('GET /api/rrhh/cargo - listarCargos()', () => {
        it('Happy Path: Debe listar cargos paginados aplicando filtros por área, jornada sugerida y activo', async () => {
            //Arrange: Simular la respuesta de la use case para listar cargos con filtros
            const queryParams: ListarCargosQueryDto = {
                page: 1,
                limit: 10,
                id_area: mockAreaId,
                jornada_sugerida_id: mockJornadaId,
                activo: true
            };

            //Simular la respuesta de la use case con datos de ejemplo y metadatos de paginación
            const mockResponse = {
                data: [{
                    id: mockCargoId,
                    nombre: 'Analista Contable',
                    id_area: mockAreaId,
                    jornada_sugerida_id: mockJornadaId,
                    area: { id: mockAreaId, nombre: 'Contabilidad' },
                    jornada_sugerida: {
                        id: mockJornadaId,
                        nombre: 'Turno Mañana',
                        tipo_jornada: 'FIJA'
                    }, _count: { empleados: 2 },
                }],
                meta: {total: 1,page: 1,limit: 10,totalPages: 1}
            };

            //Simular que la use case retorna la lista de cargos con los filtros aplicados
            mockListarCargosUseCase.listar.mockResolvedValueOnce(mockResponse);

            //Act: Ejecutar el método del controlador para listar cargos con los filtros especificados
            const result = await controller.listarCargos(queryParams);

            //Assert: Verificar que la use case fue llamada con los parámetros de consulta correctos y que el resultado es el esperado
            expect(mockListarCargosUseCase.listar).toHaveBeenCalledWith(queryParams);
            expect(result).toEqual(mockResponse);
            expect(result.data).toHaveLength(1);
            expect(result.meta.total).toBe(1);
        });

        it('Happy Path: Debe listar cargos con consulta vacía delegando al UseCase para valores por defecto', async () => {
            //Arrange: Simular la respuesta de la use case para listar cargos con consulta vacía
            const queryVacia = {} as ListarCargosQueryDto;

            //Simular la respuesta de la use case con datos vacíos y metadatos por defecto
            const mockResponseDefault = {
                data: [],
                meta: { total: 0,page: 1,limit: 50,totalPages: 0}
            };

            //Simular que la use case retorna la lista de cargos vacía con metadatos por defecto
            mockListarCargosUseCase.listar.mockResolvedValueOnce(mockResponseDefault);

            //Act: Ejecutar el método del controlador para listar cargos con consulta vacía
            const result = await controller.listarCargos(queryVacia);

            //Assert: Verificar que la use case fue llamada con la consulta vacía y que el resultado es el esperado
            expect(mockListarCargosUseCase.listar).toHaveBeenCalledWith(queryVacia);
            expect(result).toEqual(mockResponseDefault);
        });

        it('Excepción / Resiliencia: Debe propagar InternalServerErrorException si la consulta transaccional falla', async () => {
            //Arrange: Definir parámetros de consulta para listar cargos
            const queryParams: ListarCargosQueryDto = { page: 1, limit: 50 };

            //Simular que la use case lanza una excepción al intentar listar los cargos
            mockListarCargosUseCase.listar.mockRejectedValueOnce(new InternalServerErrorException({
                title: 'Error al listar cargos',
                detail: 'Fallo al consultar los cargos.'
            }));

            //Act & Assert: Ejecutar el método del controlador y verificar que se propaga la excepción esperada
            await expect(controller.listarCargos(queryParams)).rejects.toThrow(InternalServerErrorException);
        });
    });
});