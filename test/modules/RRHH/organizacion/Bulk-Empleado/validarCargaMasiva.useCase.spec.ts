import { Test, TestingModule } from '@nestjs/testing';
import { ValidarCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/validarCargaMasiva.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';

describe('ValidarCargaMasivaUseCase - Pruebas Unitarias (Dry Run)', () => {
  let useCase: ValidarCargaMasivaUseCase;

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidarCargaMasivaUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    useCase = module.get<ValidarCargaMasivaUseCase>(ValidarCargaMasivaUseCase);
  });

  describe('execute() - Pre-validación CSV', () => {
    it('Happy Path: Debe pre-validar un CSV sin realizar escrituras en BD', async () => {
      const csvContent =
        'tipo_documento,nro_documento,nombre,apellido,area,cargo,jornada,fecha_nacimiento,asig_familiar\n' +
        'DNI,70998877,Roberto,Flores Gomez,Oficina Central,Contador Principal,Turno Mañana (Oficina),1992-04-10,true\n';

      const stream = Readable.from([csvContent]);

      const reporte = await useCase.execute('test.csv', 'text/csv', stream);

      expect(reporte.total_filas).toBe(1);
      expect(reporte.filas_validas).toBe(1);
      expect(reporte.filas_invalidas).toBe(0);
      expect(reporte.errores_detalle).toHaveLength(0);
      expect(reporte.filas_validas_data[0].nro_documento).toBe('70998877');
    });

    it('Debe capturar errores de filas invalidas en el reporte de errores', async () => {
      const csvContent =
        'tipo_documento,nro_documento,nombre,apellido\n' +
        'DNI,,Roberto,Flores Gomez\n';

      const stream = Readable.from([csvContent]);

      const reporte = await useCase.execute('test.csv', 'text/csv', stream);

      expect(reporte.total_filas).toBe(1);
      expect(reporte.filas_invalidas).toBe(1);
      expect(reporte.errores_detalle[0].columna).toBe('nro_documento');
      expect(reporte.errores_detalle[0].mensaje).toBe('El número de documento es obligatorio.');
    });

    it('Debe lanzar BadRequestException si el archivo esta vacio', async () => {
      const stream = Readable.from([]);

      await expect(useCase.execute('vacio.csv', 'text/csv', stream)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});