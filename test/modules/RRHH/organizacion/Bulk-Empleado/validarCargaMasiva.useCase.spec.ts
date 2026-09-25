// test/modules/RRHH/organizacion/Bulk-Empleado/validarCargaMasiva.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ValidarCargaMasivaUseCase } from '@/modules/RRHH/organizacion/use-cases/carga-masiva/validarCargaMasiva.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';

describe('ValidarCargaMasivaUseCase - Pruebas Unitarias (Dry Run)', () => {
  let useCase: ValidarCargaMasivaUseCase;

  // Mock de catálogos en caso de que el caso de uso realice verificación cruzada
  const mockPrismaService = {
    tipo_documento: {
      findMany: jest.fn().mockResolvedValue([{ id: 'doc-1', tipo_documento: 'DNI' }]),
    },
    area: {
      findMany: jest.fn().mockResolvedValue([{ id: 'area-1', nombre: 'Oficina Central' }]),
    },
    cargo: {
      findMany: jest.fn().mockResolvedValue([{ id: 'cargo-1', nombre: 'Contador Principal' }]),
    },
    jornada: {
      findMany: jest.fn().mockResolvedValue([{ id: 'jornada-1', nombre: 'Turno Mañana (Oficina)' }]),
    },
    regimen_pension: {
      findMany: jest.fn().mockResolvedValue([{ id: 'reg-1', nombre: 'ONP' }]),
    },
    bancos: {
      findMany: jest.fn().mockResolvedValue([{ id: 'banco-1', nombre: 'BCP' }]),
    },
  };

  // Cabeceras y filas con la estructura completa de CargaMasivaFilaSchema
  const csvHeaders =
    'tipo_documento,nro_documento,nombre,apellido,sexo,estado_civil,fecha_nacimiento,direccion,departamento,provincia,distrito,fecha_inicio,asig_familiar,area,cargo,jornada,sueldo_basico,regimen_pension\n';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidarCargaMasivaUseCase,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    useCase = module.get<ValidarCargaMasivaUseCase>(ValidarCargaMasivaUseCase);
  });

  afterEach(() => jest.clearAllMocks());

  describe('execute() - Pre-validación CSV', () => {
    it('Happy Path: Debe pre-validar un CSV sin realizar escrituras en BD', async () => {
      const validRow =
        'DNI,70998877,Roberto,Flores Gomez,MASCULINO,SOLTERO,1992-04-10,Av. Central 123,LIMA,LIMA,SAN ISIDRO,2026-01-15,true,Oficina Central,Contador Principal,Turno Mañana (Oficina),3500.00,ONP\n';

      const csvContent = `${csvHeaders}${validRow}`;
      const stream = Readable.from([csvContent]);

      const reporte = await useCase.execute('test.csv', 'text/csv', stream);

      expect(reporte.total_filas).toBe(1);
      expect(reporte.filas_validas).toBe(1);
      expect(reporte.filas_invalidas).toBe(0);
      expect(reporte.errores_detalle).toHaveLength(0);
      expect(reporte.filas_validas_data[0].nro_documento).toBe('70998877');
      expect(reporte.filas_validas_data[0].sexo).toBe('MASCULINO');
      expect(reporte.filas_validas_data[0].direccion).toBe('Av. Central 123');
    });

    it('Debe capturar errores de filas inválidas en el reporte de errores', async () => {
      // Fila con todas las columnas obligatorias excepto nro_documento (vacío)
      const invalidRow =
        'DNI,,Roberto,Flores Gomez,MASCULINO,SOLTERO,1992-04-10,Av. Central 123,LIMA,LIMA,SAN ISIDRO,2026-01-15,false,Oficina Central,Contador Principal,Turno Mañana (Oficina),3500.00,ONP\n';

      const csvContent = `${csvHeaders}${invalidRow}`;
      const stream = Readable.from([csvContent]);

      const reporte = await useCase.execute('test.csv', 'text/csv', stream);

      expect(reporte.total_filas).toBe(1);
      expect(reporte.filas_invalidas).toBe(1);

      // Verificamos que se detecte el error en la columna del documento
      const errorDoc = reporte.errores_detalle.find(
        (e: any) => e.columna === 'nro_documento' || e.campo === 'nro_documento',
      );
      expect(errorDoc).toBeDefined();
      expect(errorDoc.mensaje).toMatch(/documento/i);
    });

    it('Debe lanzar BadRequestException si el archivo está vacío', async () => {
      const stream = Readable.from([]);

      await expect(useCase.execute('vacio.csv', 'text/csv', stream)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});