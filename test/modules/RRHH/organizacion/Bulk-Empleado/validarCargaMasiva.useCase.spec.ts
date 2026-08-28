//test/modules/RRHH/organizacion/Bulk-Empleado/validarCargaMasiva.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ValidarCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/validarCargaMasiva.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';

/**
 * Pruebas unitarias para el ValidarCargaMasivaUseCase.
 * Se verifica que el caso de uso maneje correctamente la pre-validación de archivos CSV,
 * incluyendo la captura de errores de filas inválidas y la generación del reporte de pre-validación.
 * Se utilizan mocks para simular la interacción con PrismaService y evitar llamadas reales a la base de datos.
 */
describe('ValidarCargaMasivaUseCase - Pruebas Unitarias (Dry Run)', () => {
  let useCase: ValidarCargaMasivaUseCase;

  const mockPrismaService = {};

  //Configuración inicial antes de cada prueba
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidarCargaMasivaUseCase,
        { provide: PrismaService, useValue: mockPrismaService }
      ]
    }).compile();

    useCase = module.get<ValidarCargaMasivaUseCase>(ValidarCargaMasivaUseCase);
  });

  describe('execute() - Pre-validación CSV', () => {
    it('Happy Path: Debe pre-validar un CSV sin realizar escrituras en BD', async () => {
      //Arrange: Simular un archivo CSV válido con una fila de datos
      const csvContent =
        'tipo_documento,nro_documento,nombre,apellido,area,cargo,jornada,fecha_nacimiento,asig_familiar\n' +
        'DNI,70998877,Roberto,Flores Gomez,Oficina Central,Contador Principal,Turno Mañana (Oficina),1992-04-10,true\n';

      //Act: Crear un stream a partir del contenido CSV simulado
      const stream = Readable.from([csvContent]);

      //Act: Ejecutar el caso de uso con el nombre del archivo, tipo MIME y el stream simulado
      const reporte = await useCase.execute('test.csv', 'text/csv', stream);

      //Assert: Verificar que el reporte de pre-validación contenga los resultados esperados
      expect(reporte.total_filas).toBe(1);
      expect(reporte.filas_validas).toBe(1);
      expect(reporte.filas_invalidas).toBe(0);
      expect(reporte.errores_detalle).toHaveLength(0);
      expect(reporte.filas_validas_data[0].nro_documento).toBe('70998877');
    });

    it('Debe capturar errores de filas invalidas en el reporte de errores', async () => {
      //Arrange: Simular un archivo CSV con una fila inválida (número de documento faltante)
      const csvContent =
        'tipo_documento,nro_documento,nombre,apellido\n' +
        'DNI,,Roberto,Flores Gomez\n';

      //Act: Crear un stream a partir del contenido CSV simulado
      const stream = Readable.from([csvContent]);

      //Act: Ejecutar el caso de uso con el nombre del archivo, tipo MIME y el stream simulado
      const reporte = await useCase.execute('test.csv', 'text/csv', stream);

      //Assert: Verificar que el reporte de pre-validación contenga los errores esperados
      expect(reporte.total_filas).toBe(1);
      expect(reporte.filas_invalidas).toBe(1);
      expect(reporte.errores_detalle[0].columna).toBe('nro_documento');
      expect(reporte.errores_detalle[0].mensaje).toBe('El número de documento es obligatorio.');
    });

    it('Debe lanzar BadRequestException si el archivo esta vacio', async () => {
      //Arrange: Crear un stream vacío para simular un archivo CSV sin contenido
      const stream = Readable.from([]);

      //Act & Assert: Ejecutar el caso de uso y verificar que se lance la excepción esperada
      await expect(useCase.execute('vacio.csv', 'text/csv', stream)).rejects.toThrow(BadRequestException);
    });
  });
});