//test/modules/RRHH/organizacion/derechohabiente/helper/derechoHabiente.helper.ts
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { validarEmpleadoTitular, validarDocumentoDerechohabiente, validarEdadSegunVinculo, } from '@/modules/RRHH/organizacion/use-cases/derechohabiente/helper/validarDerechoHabiente.helper';
import dayjs from 'dayjs';

/**
 * Pruebas unitarias para las validaciones y reglas de negocio del modulo de derechohabientes.
 * Evalua estado del empleado titular, unicidad de documentos y restricciones de edad según el vínculo.
 */
describe('DerechohabienteHelper - Pruebas unitarias', () => {
    let mockPrisma: any;

    beforeEach(() => {
        mockPrisma = {
            empleados: { findUnique: jest.fn() },
            derechohabientes: { findFirst: jest.fn() }
        };
    });

    afterEach(() => jest.clearAllMocks());

    //====================================================
    //Funcion para validar el empleado titular
    //====================================================
    describe('validarEmpleadoTitular', () => {
        describe('Caso de Exito (Happy Path)', () => {
            it('Debe retonar el titular si existe y se encuentra activo', async() => {
                //Arrange: simular colaborar activo sin cese
                const empleadoMock = { id: 'emp-uuid-1', activo: true, asig_familiar: false };
                mockPrisma.empleados.findUnique.mockResolvedValue(empleadoMock);

                //Act: ejecutar la funcion de validacion
                const result = await validarEmpleadoTitular(mockPrisma as PrismaService, 'emp-uuid-1');

                //Assert: verificar que el resultado sea el esperado
                expect(result).toEqual(empleadoMock);
                expect(mockPrisma.empleados.findUnique).toHaveBeenCalledWith({
                    where: { id: 'emp-uuid-1', deleted_at: null },
                    select: { id: true, activo: true, asig_familiar: true }
                });
            });
        });

        describe('Validaciones de Negocio y Excepciones', () => {
            it('Debe lanzar NotFoundException si el colaborador no existe en los registros', async () => {
                //Arrange: simular colaborador inexistente
                mockPrisma.empleados.findUnique.mockResolvedValue(null);

                //Act & Assert: verificar que se lance la excepcion esperada
                await expect(validarEmpleadoTitular(mockPrisma as PrismaService, 'emp-404')).rejects.toThrow(NotFoundException);
            });

            it('Debe lanzar NotFoundException si el colaborador tiene activo=false', async () => {
                //Arrange: simular colaborador con estado inactivo
                mockPrisma.empleados.findUnique.mockResolvedValue({ id: 'emp-uuid-1', activo: false });

                //Act & Assert: verificar que se lance la excepcion esperada
                await expect(validarEmpleadoTitular(mockPrisma as PrismaService, 'emp-uuid-1')).rejects.toThrow(NotFoundException);
            });
        });
    });

    //=========================================================================
    //Funcion para validar la unicidad del documento del derechohabiente
    //=========================================================================
    describe('validarDocumentoDerechohabiente()', () => {
        describe('Casos de Éxito (Happy Path)', () => {
            it('Debe resolver exitosamente si el documento no está registrado para el titular', async () => {
                //Arrange: simular que no hay duplicados en la base de datos
                mockPrisma.derechohabientes.findFirst.mockResolvedValue(null);

                //Act & Assert: verificar que la funcion se resuelva sin errores
                await expect(validarDocumentoDerechohabiente(mockPrisma as PrismaService, 'emp-1', '72334455')).resolves.toBeUndefined();
                expect(mockPrisma.derechohabientes.findFirst).toHaveBeenCalledWith({
                    where: {
                        empleado_id: 'emp-1',
                        nro_documento: '72334455',
                        deleted_at: null
                    },
                    select: { id: true }
                });
            });

            it('Debe excluir el ID del derechohabiente actual en operaciones de edición', async () => {
                //Arrange: simular que no hay duplicados en la base de datos, excluyendo el derechohabiente actual
                mockPrisma.derechohabientes.findFirst.mockResolvedValue(null);

                //Act & Assert: verificar que la funcion se resuelva sin errores y excluya el ID del derechohabiente actual
                await expect(validarDocumentoDerechohabiente(mockPrisma as PrismaService,
                    'emp-1',
                    '72334455',
                    'dh-propio-uuid'
                )).resolves.toBeUndefined();
                expect(mockPrisma.derechohabientes.findFirst).toHaveBeenCalledWith({
                    where: {
                        empleado_id: 'emp-1',
                        nro_documento: '72334455',
                        id: { not: 'dh-propio-uuid' },
                        deleted_at: null
                    },
                    select: { id: true }
                });
            });
        });

        describe('Validaciones de Negocio y Excepciones', () => {
            it('Debe lanzar ConflictException si el documento ya está asignado al empleado', async () => {
                //Arrange: simular que el documento ya existe para otro derechohabiente del mismo empleado
                mockPrisma.derechohabientes.findFirst.mockResolvedValue({ id: 'dh-existente-uuid' });

                //Act & Assert: verificar que se lance la excepcion esperada
                await expect(validarDocumentoDerechohabiente(mockPrisma as PrismaService, 'emp-1', '72334455')).rejects.toThrow(ConflictException);
            });
        });
    });

    //=========================================================================
    //Funcion para validar la edad del derechohabiente segun su vinculo con el empleado titular
    //=========================================================================
    describe('validarEdadSegunVinculo()', () => {
        describe('Casos de Éxito (Happy Path)', () => {
            it('Debe permitir HIJO_MENOR con edad inferior a 18 años', () => {
                //Arrange: calcular una fecha de nacimiento que resulte en 8 años de edad
                const fechaNac = dayjs().subtract(8, 'year').toDate();

                //Act & Assert: verificar que la funcion no lance excepcion para un hijo menor de edad
                expect(() => validarEdadSegunVinculo('HIJO_MENOR', fechaNac)).not.toThrow();
            });

            it('Debe permitir HIJO_MAYOR_ESTUDIANTE con edad entre 18 y 28 años', () => {
                //Arrange: calcular una fecha de nacimiento que resulte en 21 años de edad
                const fechaNac = dayjs().subtract(21, 'year').toDate();

                //Act & Assert: verificar que la funcion no lance excepcion para un hijo mayor estudiante
                expect(() => validarEdadSegunVinculo('HIJO_MAYOR_ESTUDIANTE', fechaNac)).not.toThrow();
            });

            it('Debe permitir CONYUGE sin restricción de minoría de edad', () => {
                //Arrange: calcular una fecha de nacimiento que resulte en 35 años de edad
                const fechaNac = dayjs().subtract(35, 'year').toDate();

                //Act & Assert: verificar que la funcion no lance excepcion para un conyuge
                expect(() => validarEdadSegunVinculo('CONYUGE', fechaNac)).not.toThrow();
            });
        });

        describe('Validaciones de Negocio y Excepciones', () => {
            it('Debe lanzar BadRequestException si la fecha de nacimiento es futura', () => {
                //Arrange: calcular una fecha futura
                const fechaFutura = dayjs().add(1, 'year').toDate();

                //Act & Assert: verificar que se lance la excepcion esperada
                expect(() => validarEdadSegunVinculo('HIJO_MAYOR_ESTUDIANTE', fechaFutura)).toThrow(BadRequestException);
            });

            it('Debe lanzar BadRequestException si HIJO_MENOR tiene 18 años o más', () => {
                //Arrange: calcular una fecha de nacimiento que resulte en exactamente 18 años de edad
                const fecha18Anos = dayjs().subtract(18, 'year').toDate();

                //Act & Assert: verificar que se lance la excepcion esperada
                expect(() => validarEdadSegunVinculo('HIJO_MENOR', fecha18Anos)).toThrow(BadRequestException);
            });

            it('Debe lanzar BadRequestException si HIJO_MAYOR_ESTUDIANTE es menor de 18 o supera los 28 años', () => {
                //Arrange: calcular fechas de nacimiento que resulten en edades fuera del rango permitido
                const fechaMenor = dayjs().subtract(16, 'year').toDate();
                const fechaExcedida = dayjs().subtract(29, 'year').toDate();

                //Act & Assert: verificar que se lance la excepcion esperada para ambos casos
                expect(() => validarEdadSegunVinculo('HIJO_MAYOR_ESTUDIANTE', fechaMenor)).toThrow(BadRequestException);
                expect(() => validarEdadSegunVinculo('HIJO_MAYOR_ESTUDIANTE', fechaExcedida)).toThrow(BadRequestException);
            });

            it('Debe lanzar BadRequestException si HIJO_MAYOR_INCAPACITADO tiene menos de 18 años', () => {
                //Arrange: calcular una fecha de nacimiento que resulte en menos de 18 años de edad
                const fechaInvalida = dayjs().subtract(15, 'year').toDate();

                //Act & Assert: verificar que se lance la excepcion esperada
                expect(() => validarEdadSegunVinculo('HIJO_MAYOR_INCAPACITADO', fechaInvalida)).toThrow(BadRequestException);
            });
        });
    });
});