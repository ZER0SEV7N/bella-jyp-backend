import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { verificarAreaActiva, verificarCargoActivo, verificarJornadaActiva, verificarDocumentoUnico, verificarNombreAreaUnico } from '@/modules/RRHH/common/verificacciones-rrhh.helper';

/**
 * Pruebas unitarias para las funciones centralizadas de verificación de RRHH.
 * Garantiza que las reglas de negocio compartidas (unicidad, existencia y estado activo)
 * respondan con las excepciones y códigos HTTP correctos.
 */
describe('VerificacionesRrhhHelper - Pruebas Unitarias Exhaustivas', () => {
    let mockPrisma: any;

    //Configuracion del mock de Prisma antes de cada test
    beforeEach(() => {
        mockPrisma = {
            area: { findUnique: jest.fn(), findFirst: jest.fn() },
            cargo: { findUnique: jest.fn() },
            jornada: { findUnique: jest.fn() },
            empleados: { findFirst: jest.fn() }
        };
    });

    afterEach(() => jest.clearAllMocks());

    //=========================================================================
    //verificarAreaActiva
    //=========================================================================
    describe('verificarAreaActiva()', () => {
        describe('Casos de Éxito (Happy Path)', () => {
            it('Debe retornar inmediatamente sin consultar la base de datos si no se proporciona areaId', async () => {
                //Act & Assert: Llamar a la función verificarAreaActiva sin areaId y verificar que no se lance ninguna excepción
                await expect(verificarAreaActiva(mockPrisma as PrismaService, undefined)).resolves.toBeUndefined();
                expect(mockPrisma.area.findUnique).not.toHaveBeenCalled();
            });

            it('Debe retornar inmediatamente si areaId es igual al areaActualId (sin cambios)', async () => {
                //Arrange: Definir areaId y areaActualId idénticos
                const idArea = 'area-uuid-1';

                //Act & Assert: Llamar a la función verificarAreaActiva con areaId igual a areaActualId y verificar que no se lance ninguna excepción
                await expect(verificarAreaActiva(mockPrisma as PrismaService, idArea, idArea)).resolves.toBeUndefined();
                expect(mockPrisma.area.findUnique).not.toHaveBeenCalled();
            });

            it('Debe validar exitosamente si el área existe y se encuentra activa', async () => {
                //Arrange: Simular que el área existe y está activa
                mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-uuid-1', activo: true });

                //Act & Assert: Llamar a la función verificarAreaActiva y verificar que no se lance ninguna excepción
                await expect(verificarAreaActiva(mockPrisma as PrismaService, 'area-uuid-1')).resolves.toBeUndefined();
                expect(mockPrisma.area.findUnique).toHaveBeenCalledWith({
                    where: { id: 'area-uuid-1', deleted_at: null },
                    select: { id: true, activo: true }
                });
            });
        });

        describe('Validaciones de Negocio y Excepciones', () => {
            it('Debe lanzar NotFoundException si el área no existe en la base de datos', async () => {
                //Arrange: Simular que el área no existe (findUnique retorna null)
                mockPrisma.area.findUnique.mockResolvedValue(null);

                //Act & Assert: Verificar que la función verificarAreaActiva lance NotFoundException al no encontrar el área
                await expect(verificarAreaActiva(mockPrisma as PrismaService, 'area-inexistente')).rejects.toThrow(NotFoundException);
            });

            it('Debe lanzar NotFoundException si el área existe pero su estado es activo=false', async () => {
                //Arrange: Simular que el área existe pero está inactiva
                mockPrisma.area.findUnique.mockResolvedValue({ id: 'area-uuid-1', activo: false });

                //Act & Assert: Verificar que la función verificarAreaActiva lance NotFoundException al encontrar el área inactiva
                await expect(verificarAreaActiva(mockPrisma as PrismaService, 'area-uuid-1')).rejects.toThrow(NotFoundException);
            });
        });
    });

    //=========================================================================
    //verificarCargoActivo
    //=========================================================================
    describe('verificarCargoActivo()', () => {
        describe('Casos de Éxito (Happy Path)', () => {
            it('Debe retornar inmediatamente si no se envía cargoId', async () => {
                //Act & Assert: Llamar a la función verificarCargoActivo sin cargoId y verificar que no se lance ninguna excepción
                await expect(verificarCargoActivo(mockPrisma as PrismaService, undefined)).resolves.toBeUndefined();
                expect(mockPrisma.cargo.findUnique).not.toHaveBeenCalled();
            });

            it('Debe retornar inmediatamente si cargoId es idéntico al cargoActualId', async () => {
                //Arrange: Definir cargoId y cargoActualId idénticos
                const idCargo = 'cargo-uuid-1';
                //Act & Assert: Llamar a la función verificarCargoActivo con cargoId igual a cargoActualId y verificar que no se lance ninguna excepción
                await expect(verificarCargoActivo(mockPrisma as PrismaService, idCargo, idCargo)).resolves.toBeUndefined();
                expect(mockPrisma.cargo.findUnique).not.toHaveBeenCalled();
            });

            it('Debe validar exitosamente si el cargo existe y se encuentra activo', async () => {
                //Arrange: Simular que el cargo existe y está activo
                mockPrisma.cargo.findUnique.mockResolvedValue({ id: 'cargo-uuid-1', activo: true });

                //Act & Assert: Llamar a la función verificarCargoActivo y verificar que no se lance ninguna excepción
                await expect(verificarCargoActivo(mockPrisma as PrismaService, 'cargo-uuid-1')).resolves.toBeUndefined();
                expect(mockPrisma.cargo.findUnique).toHaveBeenCalledWith({
                    where: { id: 'cargo-uuid-1', deleted_at: null },
                    select: { id: true, activo: true }
                });
            });
        });

        describe('Validaciones de Negocio y Excepciones', () => {
            it('Debe lanzar NotFoundException si el cargo no existe', async () => {
                //Act & Assert: Simular que el cargo no existe (findUnique retorna null) y verificar que se lance NotFoundException
                mockPrisma.cargo.findUnique.mockResolvedValue(null);
                await expect(verificarCargoActivo(mockPrisma as PrismaService, 'cargo-inexistente')).rejects.toThrow(NotFoundException);
            });

            it('Debe lanzar NotFoundException si el cargo está inactivo', async () => {
                //Act & Assert: Simular que el cargo existe pero está inactivo y verificar que se lance NotFoundException
                mockPrisma.cargo.findUnique.mockResolvedValue({ id: 'cargo-uuid-1', activo: false });
                await expect(verificarCargoActivo(mockPrisma as PrismaService, 'cargo-uuid-1')).rejects.toThrow(NotFoundException);
            });
        });
    });

    //=========================================================================
    //verificarJornadaActiva
    //=========================================================================
    describe('verificarJornadaActiva()', () => {
        describe('Casos de Éxito (Happy Path)', () => {
            it('Debe retornar inmediatamente si no se envía jornadaId o es null', async () => {
                //Act & Assert: Llamar a la función verificarJornadaActiva sin jornadaId y verificar que no se lance ninguna excepción
                await expect(verificarJornadaActiva(mockPrisma as PrismaService, null)).resolves.toBeUndefined();
                expect(mockPrisma.jornada.findUnique).not.toHaveBeenCalled();
            });

            it('Debe retornar inmediatamente si jornadaId no varió respecto a la actual', async () => {
                //Arrange: Definir jornadaId y jornadaActualId idénticos
                const idJornada = 'jornada-uuid-1';

                //Act & Assert: Llamar a la función verificarJornadaActiva con jornadaId igual a jornadaActualId y verificar que no se lance ninguna excepción
                await expect(verificarJornadaActiva(mockPrisma as PrismaService, idJornada, idJornada)).resolves.toBeUndefined();
                expect(mockPrisma.jornada.findUnique).not.toHaveBeenCalled();
            });

            it('Debe validar exitosamente si la jornada existe y está activa', async () => {
                //Arrange: Simular que la jornada existe y está activa
                mockPrisma.jornada.findUnique.mockResolvedValue({ id: 'jornada-uuid-1', activo: true });

                //Act & Assert: Llamar a la función verificarJornadaActiva y verificar que no se lance ninguna excepción
                await expect(verificarJornadaActiva(mockPrisma as PrismaService, 'jornada-uuid-1')).resolves.toBeUndefined();
                expect(mockPrisma.jornada.findUnique).toHaveBeenCalledWith({
                    where: { id: 'jornada-uuid-1', deleted_at: null },
                    select: { id: true, activo: true }
                });
            });
        });

        describe('Validaciones de Negocio y Excepciones', () => {
            it('Debe lanzar BadRequestException si la jornada no existe', async () => {
                mockPrisma.jornada.findUnique.mockResolvedValue(null);

                await expect(verificarJornadaActiva(mockPrisma as PrismaService, 'jornada-404')).rejects.toThrow(BadRequestException);
            });

            it('Debe lanzar BadRequestException si la jornada se encuentra inactiva', async () => {
                mockPrisma.jornada.findUnique.mockResolvedValue({ id: 'jornada-uuid-1', activo: false });

                await expect(verificarJornadaActiva(mockPrisma as PrismaService, 'jornada-uuid-1')).rejects.toThrow(BadRequestException);
            });
        });
    });

    //=========================================================================
    //verificarDocumentoUnico
    //=========================================================================
    describe('verificarDocumentoUnico()', () => {
        describe('Casos de Éxito (Happy Path)', () => {
            it('Debe retornar inmediatamente si nroDocumento es undefined', async () => {
                //Act & Assert: Llamar a la función verificarDocumentoUnico sin nroDocumento y verificar que no se lance ninguna excepción
                await expect(verificarDocumentoUnico(mockPrisma as PrismaService, undefined)).resolves.toBeUndefined();
                expect(mockPrisma.empleados.findFirst).not.toHaveBeenCalled();
            });

            it('Debe pasar la validación si el documento no está registrado en el sistema', async () => {
                //Arrange: Simular que no existe ningún empleado con el mismo número de documento
                mockPrisma.empleados.findFirst.mockResolvedValue(null);

                //Act & Assert: Llamar a la función verificarDocumentoUnico y verificar que no se lance ninguna excepción
                await expect(verificarDocumentoUnico(mockPrisma as PrismaService, ' 70112233 ')).resolves.toBeUndefined();
                expect(mockPrisma.empleados.findFirst).toHaveBeenCalledWith({
                    where: { nro_documento: '70112233', deleted_at: null },
                    select: { id: true }
                });
            });

            it('Debe excluir el ID del propio empleado cuando se proporciona empleadoIdExcluir', async () => {
                //Arrange: Simular que no existe ningún otro empleado con el mismo número de documento, excluyendo al propio empleado
                mockPrisma.empleados.findFirst.mockResolvedValue(null);

                //Act & Assert: Llamar a la función verificarDocumentoUnico con empleadoIdExcluir y verificar que no se lance ninguna excepción
                await expect(verificarDocumentoUnico(mockPrisma as PrismaService, '70112233', 'emp-uuid-propio')).resolves.toBeUndefined();
                expect(mockPrisma.empleados.findFirst).toHaveBeenCalledWith({
                    where: {
                        nro_documento: '70112233',
                        id: { not: 'emp-uuid-propio' },
                        deleted_at: null
                    },
                    select: { id: true }
                });
            });
        });

        describe('Validaciones de Negocio y Excepciones', () => {
            it('Debe lanzar BadRequestException si el documento ya pertenece a otro colaborador', async () => {
                //Act & Assert: Simular que existe otro empleado con el mismo número de documento y verificar que se lance BadRequestException
                mockPrisma.empleados.findFirst.mockResolvedValue({ id: 'otro-empleado-uuid' });
                await expect(verificarDocumentoUnico(mockPrisma as PrismaService, '70112233')).rejects.toThrow(BadRequestException);
            });
        });
    });

    //=========================================================================
    //verificarNombreAreaUnico
    //=========================================================================
    describe('verificarNombreAreaUnico()', () => {
        describe('Casos de Éxito (Happy Path)', () => {
            it('Debe retornar inmediatamente si el nombre no se envía o es null', async () => {
                //Act & Assert: Llamar a la función verificarNombreAreaUnico con un nombre null y verificar que no se lance ninguna excepción
                await expect(verificarNombreAreaUnico(mockPrisma as PrismaService, null)).resolves.toBeUndefined();
                expect(mockPrisma.area.findFirst).not.toHaveBeenCalled();
            });

            it('Debe validar exitosamente si el nombre no colisiona', async () => {
                //Arrange: Simular que no existe ninguna área con el mismo nombre (findFirst retorna null)
                mockPrisma.area.findFirst.mockResolvedValue(null);

                //Act & Assert: Llamar a la función verificarNombreAreaUnico y verificar que no se lance ninguna excepción
                await expect(verificarNombreAreaUnico(mockPrisma as PrismaService, '  Contabilidad  ')).resolves.toBeUndefined();
                expect(mockPrisma.area.findFirst).toHaveBeenCalledWith({
                    where: {
                        nombre: { equals: 'Contabilidad', mode: 'insensitive' },
                        deleted_at: null
                    },
                    select: { id: true }
                });
            });

            it('Debe excluir el ID del área en edición al evaluar colisiones', async () => {
                //Arrange: Simular que no existe ninguna área con el mismo nombre (findFirst retorna null)
                mockPrisma.area.findFirst.mockResolvedValue(null);

                //Act & Assert: Llamar a la función verificarNombreAreaUnico con areaIdExcluir y verificar que no se lance ninguna excepción
                await expect(verificarNombreAreaUnico(mockPrisma as PrismaService, 'Finanzas', 'area-uuid-propia')).resolves.toBeUndefined();
                expect(mockPrisma.area.findFirst).toHaveBeenCalledWith({
                    where: {
                        nombre: { equals: 'Finanzas', mode: 'insensitive' },
                        id: { not: 'area-uuid-propia' },
                        deleted_at: null
                    },
                    select: { id: true }
                });
            });
        });

        describe('Validaciones de Negocio y Excepciones', () => {
            it('Debe lanzar BadRequestException si el nombre ya está registrado en otra área', async () => {
                //Act & Assert: Simular que existe otra área con el mismo nombre y verificar que se lance BadRequestException
                mockPrisma.area.findFirst.mockResolvedValue({ id: 'area-duplicada-uuid' });
                await expect(verificarNombreAreaUnico(mockPrisma as PrismaService, 'Sistemas')).rejects.toThrow(BadRequestException);
            });
        });
    });
});