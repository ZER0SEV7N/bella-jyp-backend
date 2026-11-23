import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CrearSchemaEmpleadoCompletoDto } from '@jyp/shared-contracts';
import { CrearEmpladoCompletoUseCase } from '@/modules/RRHH/organizacion/use-cases/empleado/crearEmpleadoCompleto.useCase';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ReniecAdapter } from '@/modules/RRHH/organizacion/services/reniec.adapter';
import { verificarDocumentoUnico } from '@/modules/RRHH/common/verificacciones-rrhh.helper';
import {
  encontrarIdentidad,
  validarEntidadesEmpleado,
} from '@/modules/RRHH/organizacion/use-cases/empleado/helper/validacionesEmpleado';
import { CryptoUtil } from '@/common/utils/crypto.util';

// ── Mocks de helpers y utilidades (las rutas deben coincidir con los imports del use case) ──
jest.mock('@/modules/RRHH/common/verificacciones-rrhh.helper', () => ({
  verificarDocumentoUnico: jest.fn(),
}));
jest.mock(
  '@/modules/RRHH/organizacion/use-cases/empleado/helper/validacionesEmpleado',
  () => ({
    encontrarIdentidad: jest.fn(),
    validarEntidadesEmpleado: jest.fn(),
  })
);
jest.mock('@/common/utils/uuid.util', () => ({
  IdentityGenerator: { generateId: jest.fn(() => 'uuid-generado') },
}));
jest.mock('@/common/utils/crypto.util', () => ({
  CryptoUtil: {
    encryptOptional: jest.fn((v?: string | null) => (v ? `enc(${v})` : null)),
  },
}));
jest.mock('@/common/utils/transformacion.util', () => ({
  sanitizarTexto: jest.fn((v?: string | null) => v?.trim() || null),
  sanitizarFecha: jest.fn((v?: string | Date | null) =>
    v ? new Date(v) : null
  ),
}));

describe('CrearEmpladoCompletoUseCase', () => {
  let useCase: CrearEmpladoCompletoUseCase;
  let reniecAdapter: { consultarDni: jest.Mock };
  let prisma: {
    empleados: { create: jest.Mock };
    regimen_pension: { findUnique: jest.Mock };
    tipo_afp: { findUnique: jest.Mock };
    bancos: { findUnique: jest.Mock };
  };

  const REGIMEN_ID = 'regimen-1';
  const AFP_ID = 'afp-1';

  /** DTO válido por defecto; cada test sobrescribe lo que necesita. */
  const crearDto = (
    overrides: {
      datosEmpleado?: Record<string, unknown>;
      datosFinanciero?: Record<string, unknown>;
      derechosHabientes?: Record<string, unknown>[];
    } = {}
  ) =>
    ({
      datosEmpleado: {
        cargo_id: 'cargo-1',
        area_id: 'area-1',
        documento_id: 'doc-1',
        jornada_id: 'jornada-1',
        nro_documento: ' 70112233 ',
        nombre: 'Carlos',
        apellido: 'Mendoza Pérez',
        email: ' cmendoza@empresa.pe ',
        telefono: ' 998877665 ',
        sexo: 'MASCULINO',
        estado_civil: 'CASADO',
        nacionalidad: 'PERUANA',
        direccion: ' Av. Arriola 1234 ',
        referencia_direccion: ' Frente al parque ',
        ubigeo: ' 150115 ',
        distrito: ' La Victoria ',
        provincia: ' Lima ',
        departamento: ' Lima ',
        fecha_nacimiento: '1995-05-15T00:00:00.000Z',
        fecha_inicio: '2026-09-01T00:00:00.000Z',
        afp_fecha_filiacion: null,
        asig_familiar: false,
        ...overrides.datosEmpleado,
      },
      datosFinanciero: {
        id_regimen: REGIMEN_ID,
        id_tipo_afp: null,
        sueldo_basico: 2500,
        cuspp: null,
        tipo_comision: null,
        id_banco_sueldo: 'banco-1',
        tipo_cuenta_sueldo: 'AHORROS',
        nro_cuenta_sueldo: '1234567890',
        cci_sueldo: '00212345678901234567',
        id_banco_cts: 'banco-2',
        tipo_cuenta_cts: 'AHORROS',
        nro_cuenta_cts: '0987654321',
        cci_cts: '00209876543210987654',
        regimen_salud: 'ESSALUD',
        eps_nombre: null,
        eps_plan: null,
        eps_costo_adicional: undefined,
        ...overrides.datosFinanciero,
      },
      derechosHabientes: overrides.derechosHabientes,
    }) as unknown as CrearSchemaEmpleadoCompletoDto;

  const crearDerechohabiente = (vinculo: string) => ({
    documento_id: 'doc-1',
    nro_documento: ' 80000001 ',
    nombres: ' Luis ',
    apellidos: ' Mendoza ',
    vinculo,
    estado_civil: 'SOLTERO',
    sexo: 'MASCULINO',
    fecha_nacimiento: '2015-03-10T00:00:00.000Z',
  });

  interface EmpleadoCreateData {
    fecha_nacimiento: Date;
    fecha_inicio: Date;
    afp_fecha_filiacion: Date | null;
    estado_civil: string;
    nacionalidad: string;
    jornada_id: string | null;
    nombre: string | null;
    apellido: string | null;
    asig_familiar: boolean;
    dato_financiero: {
      create: {
        nro_cuenta_sueldo: string | null;
        cci_sueldo: string | null;
        nro_cuenta_cts: string | null;
        cci_cts: string | null;
      };
    };
    derechohabientes: {
      create: Record<string, unknown>[];
    };
  }

  /** Devuelve los `data` con los que se llamó a prisma.empleados.create. */
  const dataCreada = () => {
    const calls = prisma.empleados.create.mock.calls as [
      [{ data: EmpleadoCreateData; include: unknown }],
    ];
    return calls[0][0].data;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      empleados: {
        create: jest.fn().mockResolvedValue({ id: 'uuid-generado' }),
      },
      regimen_pension: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: REGIMEN_ID, nombre: 'ONP' }),
      },
      tipo_afp: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: AFP_ID, id_regimen: REGIMEN_ID }),
      },
      bancos: { findUnique: jest.fn().mockResolvedValue({ id: 'banco' }) },
    };
    reniecAdapter = { consultarDni: jest.fn() };

    (verificarDocumentoUnico as jest.Mock).mockResolvedValue(undefined);
    (validarEntidadesEmpleado as jest.Mock).mockResolvedValue(undefined);
    (encontrarIdentidad as jest.Mock).mockResolvedValue({
      nombre: 'Carlos',
      apellido: 'Mendoza Pérez',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        CrearEmpladoCompletoUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: ReniecAdapter, useValue: reniecAdapter },
      ],
    }).compile();

    useCase = moduleRef.get(CrearEmpladoCompletoUseCase);
  });

  // ───────────────────────────── Camino feliz ─────────────────────────────
  describe('creación exitosa', () => {
    it('retorna el empleado creado por Prisma', async () => {
      const creado = { id: 'uuid-generado', area: { id: 'a', nombre: 'TI' } };
      prisma.empleados.create.mockResolvedValue(creado);

      await expect(useCase.execute(crearDto())).resolves.toBe(creado);
    });

    it('guarda los datos del empleado limpios y con los valores fijos esperados', async () => {
      await useCase.execute(crearDto());
      const data = dataCreada();

      expect(data).toMatchObject({
        id: 'uuid-generado',
        nro_documento: '70112233',
        nombre: 'Carlos',
        apellido: 'Mendoza Pérez',
        email: 'cmendoza@empresa.pe',
        telefono: '998877665',
        direccion: 'Av. Arriola 1234',
        referencia_direccion: 'Frente al parque',
        ubigeo: '150115',
        distrito: 'La Victoria',
        provincia: 'Lima',
        departamento: 'Lima',
        estado_laboral: 'ACTIVO',
        activo: true,
        estado_sincronizacion: 'COMPLETO',
      });
      expect(data.fecha_nacimiento).toEqual(
        new Date('1995-05-15T00:00:00.000Z')
      );
      expect(data.fecha_inicio).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    });

    it('incluye área, cargo y jornada en la respuesta', async () => {
      await useCase.execute(crearDto());

      const calls = prisma.empleados.create.mock.calls as [
        [{ include: unknown }],
      ];
      expect(calls[0][0].include).toEqual({
        area: { select: { id: true, nombre: true } },
        cargo: { select: { id: true, nombre: true } },
        jornada: { select: { id: true, nombre: true } },
      });
    });

    it('usa los valores por defecto: estado civil SOLTERO, nacionalidad PERUANA y jornada null', async () => {
      await useCase.execute(
        crearDto({
          datosEmpleado: {
            estado_civil: undefined,
            nacionalidad: null,
            jornada_id: undefined,
          },
        })
      );
      const data = dataCreada();

      expect(data.estado_civil).toBe('SOLTERO');
      expect(data.nacionalidad).toBe('PERUANA');
      expect(data.jornada_id).toBeNull();
    });

    it('guarda los datos financieros con costo EPS en 0 si no se envía', async () => {
      await useCase.execute(crearDto());
      const financiero = dataCreada().dato_financiero.create;

      expect(financiero).toMatchObject({
        id_regimen: REGIMEN_ID,
        sueldo_basico: 2500,
        regimen_salud: 'ESSALUD',
        eps_costo_adicional: 0,
      });
    });
  });

  // ───────────────────────────── Identidad / RENIEC ─────────────────────────────
  describe('identidad', () => {
    it('delega en encontrarIdentidad con el adaptador, el documento y los nombres recibidos', async () => {
      await useCase.execute(crearDto());

      expect(encontrarIdentidad).toHaveBeenCalledWith(
        reniecAdapter,
        ' 70112233 ',
        'Carlos',
        'Mendoza Pérez'
      );
    });

    it('usa el nombre y apellido que devuelve encontrarIdentidad (autocompletado RENIEC)', async () => {
      (encontrarIdentidad as jest.Mock).mockResolvedValue({
        nombre: 'Ana María',
        apellido: 'Quispe Rojas',
      });

      await useCase.execute(
        crearDto({ datosEmpleado: { nombre: '', apellido: '' } })
      );

      expect(dataCreada().nombre).toBe('Ana María');
      expect(dataCreada().apellido).toBe('Quispe Rojas');
    });
  });

  // ───────────────────────────── Encriptación ─────────────────────────────
  describe('encriptación de datos bancarios', () => {
    it('encripta las cuentas y CCIs antes de guardarlas', async () => {
      const encryptSpy = jest.spyOn(CryptoUtil, 'encryptOptional');
      await useCase.execute(crearDto());
      const financiero = dataCreada().dato_financiero.create;

      expect(encryptSpy).toHaveBeenCalledTimes(4);
      expect(financiero.nro_cuenta_sueldo).toBe('enc(1234567890)');
      expect(financiero.cci_sueldo).toBe('enc(00212345678901234567)');
      expect(financiero.nro_cuenta_cts).toBe('enc(0987654321)');
      expect(financiero.cci_cts).toBe('enc(00209876543210987654)');
    });

    it('nunca guarda los números de cuenta en texto plano', async () => {
      await useCase.execute(crearDto());
      const serializado = JSON.stringify(dataCreada().dato_financiero.create);

      expect(serializado).not.toContain('"1234567890"');
      expect(serializado).not.toContain('"00212345678901234567"');
    });

    it('guarda null si no hay cuenta o CCI', async () => {
      await useCase.execute(
        crearDto({
          datosFinanciero: {
            nro_cuenta_cts: null,
            cci_cts: null,
            id_banco_cts: null,
            tipo_cuenta_cts: null,
          },
        })
      );
      const financiero = dataCreada().dato_financiero.create;

      expect(financiero.nro_cuenta_cts).toBeNull();
      expect(financiero.cci_cts).toBeNull();
    });
  });

  // ───────────────────────────── Derechohabientes / Asignación familiar ─────────────────────────────
  describe('derechohabientes y asignación familiar', () => {
    it('crea un derechohabiente por cada elemento, con acreditado_essalud en false y activo', async () => {
      await useCase.execute(
        crearDto({
          derechosHabientes: [
            crearDerechohabiente('CONYUGE'),
            crearDerechohabiente('HIJO_MENOR'),
          ],
        })
      );
      const creados = dataCreada().derechohabientes.create;

      expect(creados).toHaveLength(2);
      expect(creados[0]).toMatchObject({
        id: 'uuid-generado',
        nro_documento: '80000001',
        nombres: 'Luis',
        apellidos: 'Mendoza',
        vinculo: 'CONYUGE',
        activo: true,
        acreditado_essalud: false,
      });
    });

    it('crea una lista vacía si no se envían derechohabientes', async () => {
      await useCase.execute(crearDto({ derechosHabientes: undefined }));

      expect(dataCreada().derechohabientes.create).toEqual([]);
    });

    it.each(['HIJO_MENOR', 'HIJO_MAYOR_ESTUDIANTE'])(
      'activa la asignación familiar automáticamente si hay un %s',
      async (vinculo) => {
        await useCase.execute(
          crearDto({ derechosHabientes: [crearDerechohabiente(vinculo)] })
        );

        expect(dataCreada().asig_familiar).toBe(true);
      }
    );

    it('no activa la asignación familiar si solo hay cónyuge', async () => {
      await useCase.execute(
        crearDto({ derechosHabientes: [crearDerechohabiente('CONYUGE')] })
      );

      expect(dataCreada().asig_familiar).toBe(false);
    });

    it('respeta asig_familiar = true enviado explícitamente aunque no haya hijos', async () => {
      await useCase.execute(
        crearDto({ datosEmpleado: { asig_familiar: true } })
      );

      expect(dataCreada().asig_familiar).toBe(true);
    });
  });

  // ───────────────────────────── Validaciones del empleado ─────────────────────────────
  describe('validaciones del empleado', () => {
    it('propaga ConflictException si el documento ya existe y no crea nada', async () => {
      (verificarDocumentoUnico as jest.Mock).mockRejectedValue(
        new ConflictException('Documento duplicado')
      );

      await expect(useCase.execute(crearDto())).rejects.toThrow(
        ConflictException
      );
      expect(prisma.empleados.create).not.toHaveBeenCalled();
    });

    it('propaga NotFoundException si área, cargo o jornada no existen y no crea nada', async () => {
      (validarEntidadesEmpleado as jest.Mock).mockRejectedValue(
        new NotFoundException('Área no encontrada')
      );

      await expect(useCase.execute(crearDto())).rejects.toThrow(
        NotFoundException
      );
      expect(prisma.empleados.create).not.toHaveBeenCalled();
    });

    it('propaga BadRequestException de encontrarIdentidad (RENIEC falló y no hay datos manuales)', async () => {
      (encontrarIdentidad as jest.Mock).mockRejectedValue(
        new BadRequestException('Fallo de verificación')
      );

      await expect(useCase.execute(crearDto())).rejects.toThrow(
        BadRequestException
      );
      expect(prisma.empleados.create).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────── Validaciones financieras ─────────────────────────────
  describe('validaciones de previsión y bancos', () => {
    it('lanza NotFoundException si el régimen de pensión no existe', async () => {
      prisma.regimen_pension.findUnique.mockResolvedValue(null);

      await expect(useCase.execute(crearDto())).rejects.toThrow(
        'El régimen de pensión especificado no existe.'
      );
      expect(prisma.empleados.create).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el tipo de AFP no existe', async () => {
      prisma.tipo_afp.findUnique.mockResolvedValue(null);

      await expect(
        useCase.execute(crearDto({ datosFinanciero: { id_tipo_afp: AFP_ID } }))
      ).rejects.toThrow('El tipo de AFP especificado no existe.');
    });

    it('lanza NotFoundException si el banco del sueldo no existe', async () => {
      prisma.bancos.findUnique.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === 'banco-1' ? null : { id: where.id })
      );

      await expect(useCase.execute(crearDto())).rejects.toThrow(
        'El banco para sueldo no existe.'
      );
    });

    it('lanza NotFoundException si el banco de CTS no existe', async () => {
      prisma.bancos.findUnique.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === 'banco-2' ? null : { id: where.id })
      );

      await expect(useCase.execute(crearDto())).rejects.toThrow(
        'El banco para CTS no existe.'
      );
    });

    it('no consulta bancos ni AFP si no se envían ids', async () => {
      await useCase.execute(
        crearDto({
          datosFinanciero: {
            id_banco_sueldo: null,
            id_banco_cts: null,
            id_tipo_afp: null,
          },
        })
      );

      expect(prisma.bancos.findUnique).not.toHaveBeenCalled();
      expect(prisma.tipo_afp.findUnique).not.toHaveBeenCalled();
    });

    describe('régimen AFP/SPP', () => {
      const afpCompleta = {
        id_tipo_afp: AFP_ID,
        cuspp: 'CUSPP123',
        tipo_comision: 'FLUJO',
      };

      beforeEach(() => {
        prisma.regimen_pension.findUnique.mockResolvedValue({
          id: REGIMEN_ID,
          nombre: 'SPP - AFP',
        });
      });

      it('crea el empleado si trae administradora, CUSPP, comisión y fecha de afiliación', async () => {
        await expect(
          useCase.execute(
            crearDto({
              datosEmpleado: {
                afp_fecha_filiacion: '2026-09-01T00:00:00.000Z',
              },
              datosFinanciero: afpCompleta,
            })
          )
        ).resolves.toBeDefined();

        expect(dataCreada().afp_fecha_filiacion).toEqual(
          new Date('2026-09-01T00:00:00.000Z')
        );
      });

      it.each([
        [
          'administradora (tipo de AFP)',
          { id_tipo_afp: null },
          '2026-09-01T00:00:00.000Z',
        ],
        ['CUSPP', { cuspp: null }, '2026-09-01T00:00:00.000Z'],
        [
          'tipo de comisión',
          { tipo_comision: null },
          '2026-09-01T00:00:00.000Z',
        ],
        ['fecha de afiliación', {}, null],
      ])(
        'lanza BadRequestException si falta %s',
        async (_campo, financieroOverride, fechaFiliacion) => {
          await expect(
            useCase.execute(
              crearDto({
                datosEmpleado: { afp_fecha_filiacion: fechaFiliacion },
                datosFinanciero: { ...afpCompleta, ...financieroOverride },
              })
            )
          ).rejects.toThrow(BadRequestException);
          expect(prisma.empleados.create).not.toHaveBeenCalled();
        }
      );

      it('lanza BadRequestException si la AFP no corresponde al régimen', async () => {
        prisma.tipo_afp.findUnique.mockResolvedValue({
          id: AFP_ID,
          id_regimen: 'otro-regimen',
        });

        await expect(
          useCase.execute(
            crearDto({
              datosEmpleado: {
                afp_fecha_filiacion: '2026-09-01T00:00:00.000Z',
              },
              datosFinanciero: afpCompleta,
            })
          )
        ).rejects.toThrow('La AFP no corresponde al régimen pensionario.');
      });
    });

    it('no exige datos de AFP cuando el régimen es ONP', async () => {
      await expect(useCase.execute(crearDto())).resolves.toBeDefined();
    });
  });

  // ───────────────────────────── Errores inesperados ─────────────────────────────
  describe('errores inesperados', () => {
    it('convierte un error de Prisma en InternalServerErrorException con el detalle', async () => {
      prisma.empleados.create.mockRejectedValue(new Error('Conexión perdida'));

      const error = (await useCase
        .execute(crearDto())
        .catch((e: unknown) => e)) as InternalServerErrorException;

      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(error.getResponse()).toMatchObject({
        title: 'Error al Registrar Colaborador',
        detail: 'Conexión perdida',
      });
    });

    it('usa un mensaje genérico si el error lanzado no es una instancia de Error', async () => {
      prisma.empleados.create.mockRejectedValue('algo raro');

      const error = (await useCase
        .execute(crearDto())
        .catch((e: unknown) => e)) as InternalServerErrorException;

      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect(error.getResponse()).toMatchObject({
        detail: 'Fallo interno al intentar crear el legajo del colaborador.',
      });
    });
  });
});
