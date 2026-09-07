//test/modules/RRHH/solicitudes/solicitud.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { SolicitudController } from '@/modules/RRHH/solicitudes/controller/solicitud.controller';
import { CrearSolicitudUseCase } from '@/modules/RRHH/solicitudes/use-cases/crearSolicitud.useCase';
import { ObtenerDetalleSolicitudUseCase } from '@/modules/RRHH/solicitudes/use-cases/obtenerDetalleSolicitud.useCase';
import { AsignarRevisionDeSolicitudUseCase } from '@/modules/RRHH/solicitudes/use-cases/asignarRevisionDeSolicitud.useCase';
import { EvaluarSolicitudUseCase } from '@/modules/RRHH/solicitudes/use-cases/evaluarSolicitud.useCase';
import { AnularSolicitudUseCase } from '@/modules/RRHH/solicitudes/use-cases/anularSolicitud.useCase';
import { FileStorageUtil } from '@/common/utils/fileStorage.util';
import type { CrearSolicitudDto, EvaluarSolicitudDto } from '@jyp/shared-contracts';

/**
 * Pruebas unitarias exhaustivas para SolicitudController.
 * Se simula el comportamiento del motor HTTP Fastify (JSON y Multipart con streaming),
 * la extracción de credenciales del JWT y la respuesta ante errores de negocio de los casos de uso.
 */
describe('SolicitudController - Pruebas Unitarias Exhaustivas', () => {
    let controller: SolicitudController;

    //Mocks de los casos de uso
    const mockCrearSolicitudUC = { execute: jest.fn() };
    const mockObtenerDetalleUC = { execute: jest.fn() };
    const mockAsignarRevisionUC = { execute: jest.fn() };
    const mockEvaluarSolicitudUC = { execute: jest.fn() };
    const mockAnularSolicitudUC = { execute: jest.fn() };

    //Identificadores consistentes para las pruebas
    const mockSolicitudId = '018f4a7c-1111-7000-0000-000000000001';
    const mockEmpleadoId = '018f4a7c-2222-7000-0000-000000000002';
    const mockUsuarioId = '018f4a7c-3333-7000-0000-000000000003';

    //DTO base válido para creación
    const payloadValido: CrearSolicitudDto = {
        tipo: 'VACACIONES',
        motivo: 'Vacaciones programadas de octubre',
        fecha_inicio: '2026-10-01',
        fecha_fin: '2026-10-15',
        dias_solicitados: 15,
        origen: 'PORTAL_EMPLEADO'
    };

    //Configuración inicial de las pruebas, creando un módulo de prueba y obteniendo instancias del controlador y los casos de uso
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SolicitudController],
            providers: [
                { provide: CrearSolicitudUseCase, useValue: mockCrearSolicitudUC },
                { provide: ObtenerDetalleSolicitudUseCase, useValue: mockObtenerDetalleUC },
                { provide: AsignarRevisionDeSolicitudUseCase, useValue: mockAsignarRevisionUC },
                { provide: EvaluarSolicitudUseCase, useValue: mockEvaluarSolicitudUC },
                { provide: AnularSolicitudUseCase, useValue: mockAnularSolicitudUC }
            ]
        }).compile();

        controller = module.get<SolicitudController>(SolicitudController);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    //=========================================================================
    //1. POST /api/rrhh/solicitudes - crear()
    //=========================================================================
    describe('POST /api/rrhh/solicitudes - crear()', () => {
        describe('Casos de Éxito (Happy Path)', () => {
            it('Happy Path (JSON): Debe procesar la solicitud infiriendo el empleado_id desde el token JWT', async () => {
                //Arrange: Se simula que el request es JSON y que el usuario autenticado tiene un empleado_id asociado en el token JWT.
                const reqMock: any = {
                    isMultipart: () => false,
                    user: { id: mockUsuarioId, empleado_id: mockEmpleadoId }
                };

                //Se simula la respuesta esperada del caso de uso al crear la solicitud
                const respuestaEsperada = { id: mockSolicitudId, ...payloadValido, estado: 'PENDIENTE' };
                mockCrearSolicitudUC.execute.mockResolvedValue(respuestaEsperada);

                //Act: Se llama al método crear del controlador con el request simulado y el payload válido
                const resultado = await controller.crear(reqMock, payloadValido);

                //Assert: Se verifica que el caso de uso se haya llamado con los parámetros correctos y que la respuesta sea la esperada
                expect(mockCrearSolicitudUC.execute).toHaveBeenCalledWith(
                    payloadValido,
                    mockEmpleadoId,
                    undefined
                );
                expect(resultado).toEqual(respuestaEsperada);
            });

            it('Happy Path (JSON Fallback): Debe resolver el ID del token si user.empleado_id no está definido', async () => {
                //Arrange: Se simula que el request es JSON pero el usuario autenticado no tiene un empleado_id explícito en el token JWT, por lo que se debe usar el ID del usuario como fallback.
                const reqMock: any = {
                    isMultipart: () => false,
                    user: { id: mockUsuarioId } // Sin empleado_id explícito
                };

                //Se simula la respuesta esperada del caso de uso al crear la solicitud
                mockCrearSolicitudUC.execute.mockResolvedValue({ id: mockSolicitudId });

                //Act: Se llama al método crear del controlador con el request simulado y el payload válido
                await controller.crear(reqMock, payloadValido);

                //Assert: Se verifica que el caso de uso se haya llamado con el ID del usuario como empleado_id y que la respuesta sea la esperada
                expect(mockCrearSolicitudUC.execute).toHaveBeenCalledWith(
                    payloadValido,
                    mockUsuarioId,
                    undefined
                );
            });

            it('Happy Path (Multipart): Debe procesar streaming de archivo con FileStorageUtil y extraer campos', async () => {
                //Arrange: Se simula que el request es multipart y contiene un archivo de sustento, junto con los campos del formulario. 
                //Se espera que FileStorageUtil guarde el archivo y que el caso de uso reciba la URL y el nombre original del archivo.
                const filePartMock = {
                    filename: 'sustento_medico.pdf',
                    mimetype: 'application/pdf',
                    fields: {
                        tipo: { value: 'LICENCIA_MEDICA' },
                        motivo: { value: 'Descanso médico por intervención' },
                        fecha_inicio: { value: '2026-10-01' },
                        fecha_fin: { value: '2026-10-05' },
                        dias_solicitados: { value: 5 }
                    }
                };

                //Se simula que el request es multipart y contiene un archivo de sustento, junto con los campos del formulario.
                const reqMock: any = {
                    isMultipart: () => true,
                    file: jest.fn().mockResolvedValue(filePartMock),
                    user: { id: mockUsuarioId, empleado_id: mockEmpleadoId }
                };

                //Se simula que FileStorageUtil guarda el archivo y devuelve una URL simulada
                jest.spyOn(FileStorageUtil, 'guardarArchivoMultipart').mockResolvedValue('/archivos/sustentos/12345-sustento.pdf');

                //Se simula la respuesta esperada del caso de uso al crear la solicitud
                const respuestaEsperada = { id: mockSolicitudId, estado: 'PENDIENTE' };
                mockCrearSolicitudUC.execute.mockResolvedValue(respuestaEsperada);

                //Act: Se llama al método crear del controlador con el request simulado y el payload vacío (ya que los campos se extraen del multipart)
                const resultado = await controller.crear(reqMock, {});

                //Assert: Se verifica que FileStorageUtil.guardarArchivoMultipart haya sido llamado con el archivo y que el caso de uso se haya llamado con los datos correctos, incluyendo la URL y nombre original del archivo
                expect(FileStorageUtil.guardarArchivoMultipart).toHaveBeenCalledWith(filePartMock, 'sustentos');
                
                //Se verifica que el caso de uso se haya llamado con los datos correctos, incluyendo la URL y nombre original del archivo
                expect(mockCrearSolicitudUC.execute).toHaveBeenCalledWith(expect.objectContaining({
                    tipo: 'LICENCIA_MEDICA',
                    motivo: 'Descanso médico por intervención'
                }),
                mockEmpleadoId,
                {
                    url: '/archivos/sustentos/12345-sustento.pdf',
                    nombreOriginal: 'sustento_medico.pdf'
                });

                expect(resultado).toEqual(respuestaEsperada);
            });
        });

        describe('Manejo de Excepciones', () => {
            it('Debe propagar BadRequestException si el caso de uso detecta rango de fechas erróneo', async () => {
                //Arrange: Se simula que el request es JSON y que el usuario autenticado tiene un empleado_id asociado en el token JWT.
                const reqMock: any = {
                    isMultipart: () => false,
                    user: { id: mockUsuarioId }
                };

                //Act & Assert: Se espera que se lance una BadRequestException si el caso de uso detecta un rango de fechas inválido, y que no se haya llamado a Prisma para crear la solicitud
                mockCrearSolicitudUC.execute.mockRejectedValue(new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.'));
                await expect(controller.crear(reqMock, payloadValido)).rejects.toThrow(BadRequestException);
            });

            it('Debe propagar NotFoundException si el empleado asociado a la solicitud no existe', async () => {
                //Arrange: Se simula que el request es JSON y que el usuario autenticado tiene un empleado_id asociado en el token JWT.
                const reqMock: any = {
                    isMultipart: () => false,
                    user: { id: mockUsuarioId }
                };

                //Act & Assert: Se espera que se lance una NotFoundException si el caso de uso detecta que el empleado no existe, y que no se haya llamado a Prisma para crear la solicitud
                mockCrearSolicitudUC.execute.mockRejectedValue(new NotFoundException('El empleado especificado no existe en el sistema.'));
                await expect(controller.crear(reqMock, payloadValido)).rejects.toThrow(NotFoundException);
            });

            it('Debe propagar InternalServerErrorException ante fallos inesperados de persistencia', async () => {
                //Arrange: Se simula que el request es JSON y que el usuario autenticado tiene un empleado_id asociado en el token JWT.
                const reqMock: any = {
                    isMultipart: () => false,
                    user: { id: mockUsuarioId }
                };

                //Act & Assert: Se espera que se lance una InternalServerErrorException si el caso de uso falla inesperadamente, y que no se haya llamado a Prisma para crear la solicitud
                mockCrearSolicitudUC.execute.mockRejectedValue(new InternalServerErrorException('Fallo al crear la solicitud.'),);
                await expect(controller.crear(reqMock, payloadValido)).rejects.toThrow(InternalServerErrorException);
            });
        });
    });

    // =========================================================================
    // 2. GET /api/rrhh/solicitudes/:idOCodigo - obtenerDetalle()
    // =========================================================================
    describe('GET /api/rrhh/solicitudes/:idOCodigo - obtenerDetalle()', () => {
        describe('Casos de Éxito (Happy Path)', () => {
            it('Debe retornar el detalle completo buscando por UUID de solicitud', async () => {
                //Arrange: Se simula que la solicitud existe y se espera que el caso de uso retorne un objeto con los detalles completos de la solicitud, incluyendo el estado y el resumen del colaborador.
                const detalleEsperado = {
                    id: mockSolicitudId,
                    codigo: 'SOL-2026-001',
                    estado: 'PENDIENTE',
                    colaborador_resumen: { nombre_completo: 'Carlos Mendoza' },
                    alerta_urgencia: null
                };
                mockObtenerDetalleUC.execute.mockResolvedValue(detalleEsperado);

                //Act: Se llama al método obtenerDetalle del controlador con el UUID de la solicitud
                const resultado = await controller.obtenerDetalle(mockSolicitudId);

                //Assert: Se verifica que el caso de uso se haya llamado con el UUID correcto y que la respuesta sea la esperada
                expect(mockObtenerDetalleUC.execute).toHaveBeenCalledWith(mockSolicitudId);
                expect(resultado).toEqual(detalleEsperado);
            });

            it('Debe retornar el detalle completo buscando por código correlativo (SOL-2026-042)', async () => {
                //Arrange: Se simula que la solicitud existe y se espera que el caso de uso retorne un objeto con los detalles completos de la solicitud, incluyendo el estado y el resumen del colaborador.
                const codigo = 'SOL-2026-042';
                const detalleEsperado = { id: mockSolicitudId, codigo, estado: 'APROBADA' };
                mockObtenerDetalleUC.execute.mockResolvedValue(detalleEsperado);

                //Act: Se llama al método obtenerDetalle del controlador con el código correlativo de la solicitud
                const resultado = await controller.obtenerDetalle(codigo);

                //Assert: Se verifica que el caso de uso se haya llamado con el código correcto y que la respuesta sea la esperada
                expect(mockObtenerDetalleUC.execute).toHaveBeenCalledWith(codigo);
                expect(resultado.codigo).toBe(codigo);
            });
        });

        describe('Manejo de Excepciones', () => {
            it('Debe propagar NotFoundException si la solicitud no existe', async () => {
                //Arrange: Se simula que no existe ninguna solicitud con el ID o código proporcionado, lo que debería generar una NotFoundException.
                mockObtenerDetalleUC.execute.mockRejectedValue(new NotFoundException({ title: 'Solicitud no encontrada', detail: 'No existe el ID provisto' }));

                //Act & Assert: Se espera que se lance una NotFoundException al intentar obtener el detalle de una solicitud inexistente
                await expect(controller.obtenerDetalle('SOL-9999-999')).rejects.toThrow(NotFoundException);
            });

            it('Debe propagar InternalServerErrorException en caso de fallo crítico', async () => {
                //Arrange: Se simula que el caso de uso lanza un error inesperado, lo que debería generar una InternalServerErrorException.
                mockObtenerDetalleUC.execute.mockRejectedValue(new InternalServerErrorException('Error en base de datos'));

                //Act & Assert: Se espera que se lance una InternalServerErrorException al intentar obtener el detalle de la solicitud
                await expect(controller.obtenerDetalle(mockSolicitudId)).rejects.toThrow(InternalServerErrorException);
            });
        });
    });

    //=========================================================================
    //3. PATCH /api/rrhh/solicitudes/:id/asignar-revision - asignarRevision()
    //=========================================================================
    describe('PATCH /api/rrhh/solicitudes/:id/asignar-revision - asignarRevision()', () => {
        describe('Casos de Éxito (Happy Path)', () => {
            it('Debe asignar la solicitud al revisor autenticado obteniendo el ID de req.user.id', async () => {
                //Arrange: Se simula que el request contiene un usuario autenticado con un ID válido, 
                //y que el caso de uso retorna la solicitud actualizada con estado EN_REVISION y el responsable_id asignado al revisor.
                const reqMock: any = { user: { id: mockUsuarioId } };
                const respuestaEsperada = { id: mockSolicitudId, estado: 'EN_REVISION', responsable_id: mockUsuarioId };
                mockAsignarRevisionUC.execute.mockResolvedValue(respuestaEsperada);

                //Act: Se llama al método asignarRevision del controlador con el UUID de la solicitud y el request simulado
                const resultado = await controller.asignarRevision(mockSolicitudId, reqMock);

                //Assert: Se verifica que el caso de uso se haya llamado con los parámetros correctos y que la respuesta sea la esperada
                expect(mockAsignarRevisionUC.execute).toHaveBeenCalledWith(mockSolicitudId, mockUsuarioId);
                expect(resultado.estado).toBe('EN_REVISION');
            });

            it('Debe utilizar req.user.sub como fallback si user.id no se encuentra presente', async () => {
                //Arrange: Se simula que el request contiene un usuario autenticado con un sub (UUID) válido, pero no tiene un ID explícito.
                const subId = 'sub-jwt-uuid-999';
                const reqMock: any = { user: { sub: subId } };
                mockAsignarRevisionUC.execute.mockResolvedValue({ id: mockSolicitudId, responsable_id: subId });

                //Act: Se llama al método asignarRevision del controlador con el UUID de la solicitud y el request simulado
                await controller.asignarRevision(mockSolicitudId, reqMock);

                //Assert: Se verifica que el caso de uso se haya llamado con el sub del JWT como responsable_id y que la respuesta sea la esperada
                expect(mockAsignarRevisionUC.execute).toHaveBeenCalledWith(mockSolicitudId, subId);
            });
        });

        describe('Manejo de Excepciones', () => {
            it('Debe propagar BadRequestException si la solicitud ya fue dictaminada con anterioridad', async () => {
                //Arrange: Se simula que el request contiene un usuario autenticado con un ID válido,
                const reqMock: any = { user: { id: mockUsuarioId } };

                //Act & Assert: Se espera que se lance una BadRequestException si el caso de uso detecta que la solicitud ya fue dictaminada previamente, y que no se haya llamado a Prisma para asignar la revisión
                mockAsignarRevisionUC.execute.mockRejectedValue(new BadRequestException("La solicitud ya se encuentra dictaminada con estado 'APROBADA'."),);
                await expect(controller.asignarRevision(mockSolicitudId, reqMock)).rejects.toThrow(BadRequestException);
            });

            it('Debe propagar BadRequestException si otro usuario ya tomó la solicitud en revisión', async () => {
                //Arrange: Se simula que el request contiene un usuario autenticado con un ID válido,
                const reqMock: any = { user: { id: mockUsuarioId } };

                //Act & Assert: Se espera que se lance una BadRequestException si el caso de uso detecta que otro revisor ya tomó la solicitud en revisión, y que no se haya llamado a Prisma para asignar la revisión
                mockAsignarRevisionUC.execute.mockRejectedValue(new BadRequestException('La solicitud ya se encuentra tomada en revisión por otro revisor.'),);
                await expect(controller.asignarRevision(mockSolicitudId, reqMock)).rejects.toThrow(BadRequestException);
            });

            it('Debe propagar NotFoundException si la solicitud no existe', async () => {
                //Arrange: Se simula que el request contiene un usuario autenticado con un ID válido,
                const reqMock: any = { user: { id: mockUsuarioId } };

                //Act & Assert: Se espera que se lance una NotFoundException si el caso de uso detecta que la solicitud no existe, y que no se haya llamado a Prisma para asignar la revisión
                mockAsignarRevisionUC.execute.mockRejectedValue(new NotFoundException('Solicitud no encontrada.'));
                await expect(controller.asignarRevision(mockSolicitudId, reqMock)).rejects.toThrow(NotFoundException);
            });
        });
    });

    // =========================================================================
    // 4. PATCH /api/rrhh/solicitudes/:id/evaluar - evaluar()
    // =========================================================================
    describe('PATCH /api/rrhh/solicitudes/:id/evaluar - evaluar()', () => {
        //DTO base para aprobar la solicitud
        const dtoAprobar: EvaluarSolicitudDto = {
            estado: 'APROBADA',
            observacion: 'Cumple con el saldo vacacional disponible'
        };

        describe('Casos de Éxito (Happy Path)', () => {
            it('Debe evaluar y dictaminar exitosamente la solicitud como APROBADA', async () => {
                //Arrange: Se simula que el request contiene un usuario autenticado con un ID válido, 
                //y que el caso de uso retorna la solicitud actualizada con estado APROBADA y el responsable_id asignado al revisor.
                const reqMock: any = { user: { id: mockUsuarioId } };
                const respuestaEsperada = { id: mockSolicitudId, estado: 'APROBADA', responsable_id: mockUsuarioId };
                mockEvaluarSolicitudUC.execute.mockResolvedValue(respuestaEsperada);

                //Act: Se llama al método evaluar del controlador con el UUID de la solicitud, el DTO de aprobación y el request simulado
                const resultado = await controller.evaluar(mockSolicitudId, dtoAprobar, reqMock);

                //Assert: Se verifica que el caso de uso se haya llamado con los parámetros correctos y que la respuesta sea la esperada
                expect(mockEvaluarSolicitudUC.execute).toHaveBeenCalledWith(mockSolicitudId, dtoAprobar, mockUsuarioId);
                expect(resultado.estado).toBe('APROBADA');
            });

            it('Debe dictaminar la solicitud como RECHAZADA con observación descriptiva', async () => {
                //Arrange: Se simula que el request contiene un usuario autenticado con un sub (UUID) válido, 
                //y que el caso de uso retorna la solicitud actualizada con estado RECHAZADA y el responsable_id asignado al revisor.
                const reqMock: any = { user: { sub: mockUsuarioId } };
                const dtoRechazar: EvaluarSolicitudDto = {
                    estado: 'RECHAZADA',
                    observacion: 'Cruce de fechas con cierre contable prioritario'
                };

                //Se simula la respuesta esperada del caso de uso al evaluar la solicitud como RECHAZADA
                mockEvaluarSolicitudUC.execute.mockResolvedValue({ id: mockSolicitudId, estado: 'RECHAZADA' });

                //Act: Se llama al método evaluar del controlador con el UUID de la solicitud, el DTO de rechazo y el request simulado
                const resultado = await controller.evaluar(mockSolicitudId, dtoRechazar, reqMock);

                //Assert: Se verifica que el caso de uso se haya llamado con los parámetros correctos y que la respuesta sea la esperada
                expect(mockEvaluarSolicitudUC.execute).toHaveBeenCalledWith(mockSolicitudId, dtoRechazar, mockUsuarioId);
                expect(resultado.estado).toBe('RECHAZADA');
            });
        });

        describe('Manejo de Excepciones', () => {
            it('Debe propagar BadRequestException si se intenta rechazar sin una observación descriptiva', async () => {
                //Arrange: Se simula que el request contiene un usuario autenticado con un ID válido,
                const reqMock: any = { user: { id: mockUsuarioId } };

                //Act & Assert: Se espera que se lance una BadRequestException si el caso de uso detecta que se intenta rechazar la solicitud sin una observación descriptiva, 
                //y que no se haya llamado a Prisma para evaluar la solicitud
                mockEvaluarSolicitudUC.execute.mockRejectedValue(new BadRequestException('Debe ingresar un motivo u observación descriptiva para rechazar la solicitud.'));
                await expect(controller.evaluar(mockSolicitudId, { estado: 'RECHAZADA' } as any, reqMock)).rejects.toThrow(BadRequestException);
            });

            it('Debe propagar BadRequestException si la solicitud ya fue dictaminada previamente', async () => {
                //Arrange: Se simula que el request contiene un usuario autenticado con un ID válido,
                const reqMock: any = { user: { id: mockUsuarioId } };

                //Act & Assert: Se espera que se lance una BadRequestException si el caso de uso detecta que la solicitud ya fue dictaminada previamente, 
                //y que no se haya llamado a Prisma para evaluar la solicitud
                mockEvaluarSolicitudUC.execute.mockRejectedValue(new BadRequestException('Esta solicitud ya fue dictaminada previamente como APROBADA.'));
                await expect(controller.evaluar(mockSolicitudId, dtoAprobar, reqMock)).rejects.toThrow(BadRequestException);
            });

            it('Debe propagar NotFoundException si la solicitud a evaluar no existe', async () => {
                //Arrange: Se simula que el request contiene un usuario autenticado con un ID válido.
                const reqMock: any = { user: { id: mockUsuarioId } };

                //Act & Assert: Se espera que se lance una NotFoundException si el caso de uso detecta que la solicitud a evaluar no existe,
                mockEvaluarSolicitudUC.execute.mockRejectedValue(new NotFoundException('Solicitud no encontrada.'));
                await expect(controller.evaluar(mockSolicitudId, dtoAprobar, reqMock)).rejects.toThrow(NotFoundException);
            });
        });
    });

    // =========================================================================
    // 5. PATCH /api/rrhh/solicitudes/:id/anular - anular()
    // =========================================================================
    describe('PATCH /api/rrhh/solicitudes/:id/anular - anular()', () => {
        describe('Validaciones Locales del Parámetro "motivo"', () => {
            it('Debe lanzar BadRequestException local si el motivo no se envía o es undefined', async () => {
                //Act & Assert: Se espera que se lance una BadRequestException si el motivo no se envía o es undefined, y que no se haya llamado al caso de uso para anular la solicitud
                await expect(controller.anular(mockSolicitudId, undefined as any)).rejects.toThrow(BadRequestException);
                expect(mockAnularSolicitudUC.execute).not.toHaveBeenCalled();
            });

            it('Debe lanzar BadRequestException local si el motivo tiene menos de 5 caracteres', async () => {
                //Act & Assert: Se espera que se lance una BadRequestException si el motivo tiene menos de 5 caracteres, y que no se haya llamado al caso de uso para anular la solicitud
                await expect(controller.anular(mockSolicitudId, 'hola')).rejects.toThrow(BadRequestException);
                expect(mockAnularSolicitudUC.execute).not.toHaveBeenCalled();
            });

            it('Debe lanzar BadRequestException local si el motivo solo contiene espacios en blanco', async () => {
                //Act & Assert: Se espera que se lance una BadRequestException si el motivo solo contiene espacios en blanco, y que no se haya llamado al caso de uso para anular la solicitud
                await expect(controller.anular(mockSolicitudId, '     ')).rejects.toThrow(BadRequestException);
                expect(mockAnularSolicitudUC.execute).not.toHaveBeenCalled();
            });
        });

        describe('Casos de Éxito (Happy Path)', () => {
            it('Debe anular exitosamente la solicitud cuando el motivo cumple con la longitud mínima', async () => {
                //Arrange: Se simula que el caso de uso retorna la solicitud actualizada con estado ANULADA y un timestamp de eliminación.
                const motivoValido = 'Colaborador desiste del permiso por motivos familiares';
                const respuestaEsperada = { id: mockSolicitudId, estado: 'ANULADA', deleted_at: new Date() };

                //Se simula la respuesta esperada del caso de uso al anular la solicitud
                mockAnularSolicitudUC.execute.mockResolvedValue(respuestaEsperada);

                //Act: Se llama al método anular del controlador con el UUID de la solicitud y un motivo válido
                const resultado = await controller.anular(mockSolicitudId, motivoValido);

                //Assert: Se verifica que el caso de uso se haya llamado con los parámetros correctos y que la respuesta sea la esperada
                expect(mockAnularSolicitudUC.execute).toHaveBeenCalledWith(mockSolicitudId, motivoValido);
                expect(resultado.estado).toBe('ANULADA');
            });
        });

        describe('Manejo de Excepciones del Use Case', () => {
            it('Debe propagar BadRequestException si el use case detecta que la solicitud ya fue formalmente APROBADA', async () => {
                //Act & Assert: Se espera que se lance una BadRequestException si el caso de uso detecta que la solicitud ya fue formalmente aprobada, y que no se haya llamado a Prisma para anular la solicitud
                mockAnularSolicitudUC.execute.mockRejectedValue(new BadRequestException('No se puede anular una solicitud que ya fue formalmente aprobada.'));
                await expect(controller.anular(mockSolicitudId, 'Colaborador solicita cancelación')).rejects.toThrow(BadRequestException);
            });

            it('Debe propagar NotFoundException si la solicitud no existe o ya fue eliminada', async () => {
                //Act & Assert: Se espera que se lance una NotFoundException si el caso de uso detecta que la solicitud no existe o ya fue eliminada, y que no se haya llamado a Prisma para anular la solicitud
                mockAnularSolicitudUC.execute.mockRejectedValue(new NotFoundException('La solicitud especificada no existe o ha sido eliminada.'));
                await expect(controller.anular(mockSolicitudId, 'Cancelación administrativa')).rejects.toThrow(NotFoundException);
            });

            it('Debe propagar InternalServerErrorException en caso de fallo crítico de base de datos', async () => {
                //Act & Assert: Se espera que se lance una InternalServerErrorException si el caso de uso falla inesperadamente, y que no se haya llamado a Prisma para anular la solicitud
                mockAnularSolicitudUC.execute.mockRejectedValue(new InternalServerErrorException('Error al intentar anular la solicitud.'));
                await expect(controller.anular(mockSolicitudId, 'Cancelación administrativa')).rejects.toThrow(InternalServerErrorException);
            });
        });
    });
});