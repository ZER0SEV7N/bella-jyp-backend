//test/modules/core/audit/helpers/presentar-actividad.helper.spec.ts
import {
  clasificarAccionAuditoria,
  rellenarPlantilla,
  presentarActividad,
  presentarDetalleActividad,
  type FilaAuditoriaActividad,
} from '@/modules/core/audit/helpers/presentar-actividad.helper';
import { FilaActividadAuditoriaSchema } from '@jyp/shared-contracts';
import type { ClienteNombresAuditoria } from '@/modules/core/audit/helpers/resolver-nombres-auditoria.helper';
import {
  crearNombresResueltosVacios,
  formatearValorAuditoria,
} from '@/modules/core/audit/helpers/formatear-valor-auditoria.helper';

const ID_EMPLEADO = '0192a000-0000-7000-8000-000000000001';
const ID_EMPLEADO_2 = '0192a000-0000-7000-8000-000000000002';
const ID_CARGO_ANTES = '0192a000-0000-7000-8000-0000000000c1';
const ID_CARGO_DESPUES = '0192a000-0000-7000-8000-0000000000c2';
const ID_AREA = '0192a000-0000-7000-8000-0000000000a1';
const ID_USUARIO = '0192a000-0000-7000-8000-0000000000b1';
const ID_BANCO = '0192a000-0000-7000-8000-0000000000d1';
const ID_REGIMEN = '0192a000-0000-7000-8000-0000000000e1';
const ID_JORNADA = '0192a000-0000-7000-8000-0000000000f1';
const ID_DERECHOHABIENTE = '0192a000-0000-7000-8000-0000000000dd';

/** Prisma simulado: cada modelo de catálogo responde con datos fijos y cuenta sus consultas. */
function crearPrismaSimulado() {
  const mock = {
    empleados: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: ID_EMPLEADO,
          nombre: 'Luis',
          apellido: 'Quispe',
          nro_documento: '45871236',
        },
        {
          id: ID_EMPLEADO_2,
          nombre: 'Rosa',
          apellido: 'Díaz',
          nro_documento: '40123987',
        },
      ]),
    },
    area: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: ID_AREA, nombre: 'Contabilidad' }]),
    },
    cargo: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: ID_CARGO_ANTES,
          nombre: 'Asistente contable',
          area: { nombre: 'Contabilidad' },
        },
        {
          id: ID_CARGO_DESPUES,
          nombre: 'Contador',
          area: { nombre: 'Contabilidad' },
        },
      ]),
    },
    jornada: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: ID_JORNADA, nombre: 'Oficina 44 h' }]),
    },
    bancos: {
      findMany: jest.fn().mockResolvedValue([{ id: ID_BANCO, nombre: 'BCP' }]),
    },
    tipo_afp: { findMany: jest.fn().mockResolvedValue([]) },
    regimen_pension: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: ID_REGIMEN, nombre: 'ONP' }]),
    },
    tipo_documento: { findMany: jest.fn().mockResolvedValue([]) },
    derechohabientes: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: ID_DERECHOHABIENTE,
          nombres: 'Carlos',
          apellidos: 'Quispe',
          vinculo: 'HIJO_MENOR',
        },
      ]),
    },
    usuarios: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: ID_USUARIO,
          email: 'ana@jyp.pe',
          empleados: { nombre: 'Ana', apellido: 'Torres' },
        },
      ]),
    },
  };
  return { mock, cliente: mock as unknown as ClienteNombresAuditoria };
}

const ACTOR = {
  id: ID_USUARIO,
  rol: 'RRHH',
  email: 'ana@jyp.pe',
  empleados: { nombre: 'Ana', apellido: 'Torres' },
};

function crearFila(
  sobrescribir: Partial<FilaAuditoriaActividad>
): FilaAuditoriaActividad {
  return {
    id: '0193a000-0000-7000-8000-000000000001',
    created_at: new Date('2026-11-08T15:20:00.000Z'),
    accion: 'UPDATE',
    tabla_afectada: 'empleados',
    registro_id: ID_EMPLEADO,
    valores_antes: null,
    valores_despues: null,
    afectado_tipo: 'empleado',
    afectado_id: ID_EMPLEADO,
    usuarios: ACTOR,
    ...sobrescribir,
  };
}

const empleadoBase = {
  id: ID_EMPLEADO,
  nombre: 'Luis',
  apellido: 'Quispe',
  cargo_id: ID_CARGO_ANTES,
  area_id: ID_AREA,
  telefono: '999111222',
  activo: true,
  deleted_at: null,
  updated_at: '2026-11-01T10:00:00.000Z',
};

describe('presentarActividad', () => {
  describe('resumen y campos modificados', () => {
    it('Debe armar el resumen, el actor y el afectado de una edición con IDs traducidos a nombres', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        valores_antes: empleadoBase,
        valores_despues: {
          ...empleadoBase,
          cargo_id: ID_CARGO_DESPUES,
          telefono: '999333444',
          updated_at: '2026-11-08T15:20:00.000Z',
        },
      });

      // Act
      const [resultado] = await presentarActividad(cliente, [fila]);

      // Assert
      expect(resultado).toEqual({
        id: fila.id,
        fecha: '2026-11-08T15:20:00.000Z',
        accion: 'UPDATE',
        accion_etiqueta: 'Edición',
        modulo: 'empleados',
        modulo_etiqueta: 'Empleados',
        registro_id: ID_EMPLEADO,
        actor: { id: ID_USUARIO, nombre: 'Ana Torres', rol: 'RRHH' },
        afectado: {
          tipo: 'empleado',
          id: ID_EMPLEADO,
          nombre: 'Luis Quispe',
          detalle: '45871236',
        },
        resumen: 'Editó los datos de Luis Quispe: Cargo, Teléfono',
        campos_modificados: ['Cargo', 'Teléfono'],
      });
    });

    it('Debe devolver el registro_id de la solicitud para enlazar a su pantalla y cumplir el contrato', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const idSolicitud = '0192a000-0000-7000-8000-0000000000aa';
      const fila = crearFila({
        accion: 'UPDATE',
        tabla_afectada: 'solicitud',
        registro_id: idSolicitud,
        valores_antes: {
          id: idSolicitud,
          codigo: 'SOL-0001',
          empleado_id: ID_EMPLEADO,
          estado: 'PENDIENTE',
        },
        valores_despues: {
          id: idSolicitud,
          codigo: 'SOL-0001',
          empleado_id: ID_EMPLEADO,
          estado: 'APROBADA',
        },
      });

      // Act
      const [resultado] = await presentarActividad(cliente, [fila]);

      // Assert
      expect(resultado.modulo).toBe('solicitud');
      expect(resultado.registro_id).toBe(idSolicitud);
      expect(FilaActividadAuditoriaSchema.safeParse(resultado).success).toBe(
        true
      );
    });

    it('Debe devolver actor null cuando el cambio lo hizo el sistema', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        usuarios: null,
        valores_antes: empleadoBase,
        valores_despues: { ...empleadoBase, telefono: '1' },
      });

      // Act
      const [resultado] = await presentarActividad(cliente, [fila]);

      // Assert
      expect(resultado.actor).toBeNull();
    });

    it('Debe atribuir el calendario laboral a la empresa, sin id', async () => {
      // Arrange
      const { cliente, mock } = crearPrismaSimulado();
      const fila = crearFila({
        accion: 'CREATE',
        tabla_afectada: 'asistencia_calendario',
        afectado_tipo: 'empresa',
        afectado_id: null,
        valores_despues: {
          id: 'x',
          fecha: '2026-12-25T00:00:00.000Z',
          nombre: 'Navidad',
          motivo: 'Feriado',
          activo: true,
          usuario_id: ID_USUARIO,
        },
      });

      // Act
      const [resultado] = await presentarActividad(cliente, [fila]);

      // Assert
      expect(resultado.afectado).toEqual({
        tipo: 'empresa',
        id: null,
        nombre: 'Empresa',
        detalle: null,
      });
      expect(resultado.resumen).toBe(
        'Agregó el día Navidad (2026-12-25) al calendario laboral'
      );
      expect(mock.empleados.findMany).not.toHaveBeenCalled();
    });

    it('Debe deducir el afectado de los valores si la fila es anterior al relleno de las columnas', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        accion: 'CREATE',
        tabla_afectada: 'contratos',
        afectado_tipo: null,
        afectado_id: null,
        valores_despues: {
          id: 'c1',
          empleado_id: ID_EMPLEADO,
          estado: 'VIGENTE',
          renovado: false,
        },
      });

      // Act
      const [resultado] = await presentarActividad(cliente, [fila]);

      // Assert
      expect(resultado.afectado?.nombre).toBe('Luis Quispe');
      expect(resultado.resumen).toBe('Registró un contrato de Luis Quispe');
    });
  });

  describe('baja y reactivación', () => {
    it('Debe presentar como Baja un UPDATE que llena deleted_at y pasa activo a false, sin mostrar esos campos', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        valores_antes: empleadoBase,
        valores_despues: {
          ...empleadoBase,
          activo: false,
          deleted_at: '2026-11-08T15:20:00.000Z',
        },
      });

      // Act
      const [resultado] = await presentarActividad(cliente, [fila]);

      // Assert
      expect(resultado.accion_etiqueta).toBe('Baja');
      expect(resultado.resumen).toBe('Dio de baja a Luis Quispe');
      expect(resultado.campos_modificados).toEqual([]);
    });

    it('Debe presentar como Reactivación el UPDATE inverso', () => {
      // Arrange
      const antes = {
        ...empleadoBase,
        activo: false,
        deleted_at: '2026-11-08T15:20:00.000Z',
      };
      const despues = { ...empleadoBase, activo: true, deleted_at: null };

      // Act
      const accion = clasificarAccionAuditoria({
        accion: 'UPDATE',
        valores_antes: antes,
        valores_despues: despues,
      });

      // Assert
      expect(accion).toBe('REACTIVACION');
    });

    it('Debe detectar la baja cuando solo cambia activo a false', () => {
      // Arrange
      const antes = { activo: true };
      const despues = { activo: false };

      // Act
      const accion = clasificarAccionAuditoria({
        accion: 'UPDATE',
        valores_antes: antes,
        valores_despues: despues,
      });

      // Assert
      expect(accion).toBe('BAJA');
    });

    it('Debe conservar los demás campos editados junto con la baja', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        valores_antes: empleadoBase,
        valores_despues: {
          ...empleadoBase,
          activo: false,
          deleted_at: '2026-11-08T15:20:00.000Z',
          telefono: '000',
        },
      });

      // Act
      const [resultado] = await presentarActividad(cliente, [fila]);

      // Assert
      expect(resultado.accion_etiqueta).toBe('Baja');
      expect(resultado.campos_modificados).toEqual(['Teléfono']);
    });

    it.each([
      ['CREATE', 'CREACION'],
      ['DELETE', 'ELIMINACION'],
      ['CREATEMANY', 'CREACION'],
      ['DELETEMANY', 'ELIMINACION'],
      ['UPDATEMANY', 'EDICION'],
    ])('Debe traducir la acción técnica %s a %s', (accion, esperada) => {
      // Arrange y Act
      const resultado = clasificarAccionAuditoria({
        accion,
        valores_antes: null,
        valores_despues: null,
      });

      // Assert
      expect(resultado).toBe(esperada);
    });

    it('Debe tratar un UPSERT con created_at igual a updated_at como creación y los demás como edición', () => {
      // Arrange
      const nuevo = {
        created_at: '2026-11-08T15:20:00.000Z',
        updated_at: '2026-11-08T15:20:00.100Z',
      };
      const existente = {
        created_at: '2026-01-01T10:00:00.000Z',
        updated_at: '2026-11-08T15:20:00.000Z',
      };

      // Act y Assert
      expect(
        clasificarAccionAuditoria({
          accion: 'UPSERT',
          valores_antes: null,
          valores_despues: nuevo,
        })
      ).toBe('CREACION');
      expect(
        clasificarAccionAuditoria({
          accion: 'UPSERT',
          valores_antes: null,
          valores_despues: existente,
        })
      ).toBe('EDICION');
    });
  });

  describe('resolución de nombres en lote', () => {
    it('Debe hacer una sola consulta por entidad aunque la página tenga muchas filas', async () => {
      // Arrange
      const { cliente, mock } = crearPrismaSimulado();
      const filas = [
        crearFila({
          id: 'f1',
          valores_antes: empleadoBase,
          valores_despues: { ...empleadoBase, cargo_id: ID_CARGO_DESPUES },
        }),
        crearFila({
          id: 'f2',
          registro_id: ID_EMPLEADO_2,
          afectado_id: ID_EMPLEADO_2,
          valores_antes: { ...empleadoBase, id: ID_EMPLEADO_2 },
          valores_despues: {
            ...empleadoBase,
            id: ID_EMPLEADO_2,
            cargo_id: ID_CARGO_DESPUES,
          },
        }),
        crearFila({
          id: 'f3',
          accion: 'CREATE',
          tabla_afectada: 'dato_financiero',
          valores_despues: {
            empleado_id: ID_EMPLEADO,
            id_regimen: ID_REGIMEN,
            id_banco_sueldo: ID_BANCO,
            sueldo_basico: '1500',
          },
        }),
      ];

      // Act
      const resultado = await presentarActividad(cliente, filas);

      // Assert
      expect(resultado).toHaveLength(3);
      expect(mock.empleados.findMany).toHaveBeenCalledTimes(1);
      expect(mock.cargo.findMany).toHaveBeenCalledTimes(1);
      expect(mock.area.findMany).toHaveBeenCalledTimes(1);
      expect(mock.bancos.findMany).toHaveBeenCalledTimes(1);
      expect(mock.regimen_pension.findMany).toHaveBeenCalledTimes(1);
      const idsEmpleados = (
        (mock.empleados.findMany.mock.calls as unknown[][])[0][0] as {
          where: { id: { in: string[] } };
        }
      ).where.id.in;
      expect([...idsEmpleados].sort()).toEqual(
        [ID_EMPLEADO, ID_EMPLEADO_2].sort()
      );
      expect(mock.tipo_afp.findMany).not.toHaveBeenCalled();
      expect(mock.tipo_documento.findMany).not.toHaveBeenCalled();
    });

    it('No debe consultar nada si la página no tiene referencias', async () => {
      // Arrange
      const { cliente, mock } = crearPrismaSimulado();

      // Act
      const resultado = await presentarActividad(cliente, []);

      // Assert
      expect(resultado).toEqual([]);
      for (const modelo of Object.values(mock))
        expect(modelo.findMany).not.toHaveBeenCalled();
    });

    it('Debe mostrar el ID cuando el registro referenciado ya no existe', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const idHuerfano = '0192a000-0000-7000-8000-0000000000ff';
      const fila = crearFila({
        valores_antes: empleadoBase,
        valores_despues: { ...empleadoBase, cargo_id: idHuerfano },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios[0]).toMatchObject({
        campo: 'cargo_id',
        antes: 'Asistente contable',
        despues: idHuerfano,
      });
    });
  });

  describe('detalle de cambios', () => {
    it('Debe presentar el cambio de cargo con tipo referencia y nombres', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        valores_antes: empleadoBase,
        valores_despues: { ...empleadoBase, cargo_id: ID_CARGO_DESPUES },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toEqual([
        {
          campo: 'cargo_id',
          etiqueta: 'Cargo',
          tipo: 'referencia',
          antes: 'Asistente contable',
          despues: 'Contador',
        },
      ]);
    });

    it('Debe marcar como protegidos los datos bancarios y el CUSPP sin exponer valores', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        accion: 'CREATE',
        tabla_afectada: 'dato_financiero',
        valores_antes: null,
        valores_despues: {
          id: 'df1',
          empleado_id: ID_EMPLEADO,
          id_regimen: ID_REGIMEN,
          id_banco_sueldo: ID_BANCO,
          sueldo_basico: '2500.5',
          nro_cuenta_sueldo: '[OCULTO]',
          cci_sueldo: '[OCULTO]',
          cuspp: '[OCULTO]',
          regimen_salud: 'ESSALUD_REGULAR',
          eps_costo_adicional: '0',
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      const porCampo = Object.fromEntries(
        detalle.cambios.map((c) => [c.campo, c])
      );
      expect(porCampo.nro_cuenta_sueldo).toEqual({
        campo: 'nro_cuenta_sueldo',
        etiqueta: 'Cuenta de sueldo',
        tipo: 'texto',
        antes: null,
        despues: null,
        protegido: true,
      });
      expect(porCampo.cci_sueldo.protegido).toBe(true);
      expect(porCampo.cuspp.protegido).toBe(true);
      expect(JSON.stringify(detalle)).not.toContain('[OCULTO]');
      expect(porCampo.sueldo_basico).toMatchObject({
        tipo: 'moneda',
        antes: null,
        despues: 'S/ 2,500.50',
      });
      expect(porCampo.id_banco_sueldo.despues).toBe('BCP');
      expect(porCampo.regimen_salud.despues).toBe('EsSalud regular');
    });

    it('En una creación debe omitir el ID de contexto que ya está en el afectado', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        accion: 'CREATE',
        tabla_afectada: 'contratos',
        valores_despues: {
          id: 'c1',
          empleado_id: ID_EMPLEADO,
          estado: 'VIGENTE',
          fecha_inicio: '2026-11-01T00:00:00.000Z',
          renovado: false,
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios.map((c) => c.campo)).toEqual([
        'estado',
        'fecha_inicio',
        'renovado',
      ]);
      expect(detalle.cambios[1]).toMatchObject({
        tipo: 'fecha',
        despues: '2026-11-01',
      });
      expect(detalle.cambios[2]).toMatchObject({
        tipo: 'booleano',
        despues: 'No',
      });
    });

    it('No debe tratar como cambio un decimal que solo cambia de formato', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        tabla_afectada: 'cargo',
        afectado_tipo: 'cargo',
        valores_antes: { id: 'c', nombre: 'Contador', sueldo_minimo: '1130.5' },
        valores_despues: { id: 'c', nombre: 'Contador', sueldo_minimo: 1130.5 },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toEqual([]);
    });

    it('Debe normalizar fecha y hora a la hora de Lima y mostrar enums con su etiqueta', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        accion: 'CREATE',
        tabla_afectada: 'asistencia_marcacion',
        valores_despues: {
          id: 'm1',
          empleado_id: ID_EMPLEADO,
          tipo_marcacion: 'SALIDA_ALMUERZO',
          fecha_hora: '2026-11-08T17:05:00.000Z',
          metodo: 'MANUAL',
          usuario_id: ID_USUARIO,
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      const porCampo = Object.fromEntries(
        detalle.cambios.map((c) => [c.campo, c])
      );
      expect(porCampo.tipo_marcacion.despues).toBe('Salida a almuerzo');
      expect(porCampo.fecha_hora.despues).toBe('2026-11-08 12:05');
      expect(porCampo.usuario_id.despues).toBe('Ana Torres');
      expect(detalle.resumen).toBe(
        'Registró una marcación (Salida a almuerzo) de Luis Quispe'
      );
    });

    it('Debe ocultar los campos marcados como ocultos y los técnicos', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        accion: 'CREATE',
        tabla_afectada: 'derechohabiente_documentos',
        valores_despues: {
          id: 'd1',
          derechohabiente_id: ID_DERECHOHABIENTE,
          tipo_documento: 'PARTIDA_NACIMIENTO',
          nombre_archivo: 'partida.pdf',
          archivo_url: 'archivos/partida.pdf',
          vigente: true,
          created_at: '2026-11-08T15:20:00.000Z',
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios.map((c) => c.campo)).toEqual([
        'derechohabiente_id',
        'tipo_documento',
        'nombre_archivo',
        'vigente',
      ]);
      expect(detalle.cambios[0]).toEqual({
        campo: 'derechohabiente_id',
        etiqueta: 'Familiar',
        tipo: 'referencia',
        antes: null,
        despues: 'Carlos Quispe',
      });
      expect(detalle.resumen).toBe(
        'Subió un documento de Carlos Quispe (hijo menor), familiar de Luis Quispe'
      );
    });

    it('Debe mostrar el nombre técnico como etiqueta de un campo nuevo que aún no está configurado', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        valores_antes: { ...empleadoBase, talla_uniforme: 'M' },
        valores_despues: { ...empleadoBase, talla_uniforme: 'L' },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toEqual([
        {
          campo: 'talla_uniforme',
          etiqueta: 'talla_uniforme',
          tipo: 'texto',
          antes: 'M',
          despues: 'L',
        },
      ]);
    });
  });

  describe('filas guardadas con relaciones de include', () => {
    const relaciones = {
      area: { id: ID_AREA, nombre: 'Contabilidad' },
      cargo: { id: ID_CARGO_ANTES, nombre: 'Asistente contable' },
    };

    it('No debe mostrar area ni cargo como cambios ni nombrarlos en el resumen cuando solo cambia el estado laboral', async () => {
      // Arrange: el UPDATE se hizo con include, así que solo valores_despues trae las relaciones.
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        valores_antes: { ...empleadoBase, estado_laboral: 'ACTIVO' },
        valores_despues: {
          ...empleadoBase,
          estado_laboral: 'LICENCIA',
          ...relaciones,
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toEqual([
        {
          campo: 'estado_laboral',
          etiqueta: 'Estado laboral',
          tipo: 'enum',
          antes: 'Activo',
          despues: 'De licencia',
        },
      ]);
      expect(detalle.campos_modificados).toEqual(['Estado laboral']);
      expect(detalle.resumen).toBe(
        'Editó los datos de Luis Quispe: Estado laboral'
      );
      expect(detalle.resumen).not.toMatch(/area|cargo/);
    });

    it('Debe seguir comparando un Json escalar como el horario en una fila que también trae relaciones', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const horario = (entrada: string) => [
        { dia: 'LUNES', laborable: true, entrada },
      ];
      const fila = crearFila({
        tabla_afectada: 'asistencia_jornada',
        valores_antes: { horario: horario('08:00') },
        valores_despues: {
          horario: horario('09:00'),
          empleado: { id: ID_EMPLEADO },
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios.map((c) => c.campo)).toEqual(['horario']);
      expect(detalle.cambios[0].detalle?.[0].cambios[0]).toMatchObject({
        campo: 'entrada',
        antes: '08:00',
        despues: '09:00',
      });
    });
  });

  describe('listas anidadas (horario)', () => {
    const dia = (
      nombre: string,
      entrada: string | null,
      salida: string | null,
      laborable = true
    ) => ({
      dia: nombre,
      laborable,
      entrada,
      salida,
      inicio_descanso: laborable ? '13:00' : null,
      fin_descanso: laborable ? '14:00' : null,
    });
    const horarioAntes = [
      dia('LUNES', '08:00', '17:00'),
      dia('MARTES', '08:00', '17:00'),
      dia('DOMINGO', null, null, false),
    ];

    it('Debe comparar el horario por elemento y mostrar solo los días que cambiaron', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const horarioDespues = [
        dia('LUNES', '08:00', '17:00'),
        dia('MARTES', '09:00', '18:00'),
        dia('DOMINGO', null, null, false),
      ];
      const fila = crearFila({
        tabla_afectada: 'asistencia_jornada',
        valores_antes: {
          id: 'j1',
          empleado_id: ID_EMPLEADO,
          jornada_id: ID_JORNADA,
          horario: horarioAntes,
          minutos_semana: 2640,
        },
        valores_despues: {
          id: 'j1',
          empleado_id: ID_EMPLEADO,
          jornada_id: ID_JORNADA,
          horario: horarioDespues,
          minutos_semana: 2640,
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toHaveLength(1);
      expect(detalle.cambios[0]).toMatchObject({
        campo: 'horario',
        etiqueta: 'Horario semanal',
        tipo: 'lista',
        antes: null,
        despues: null,
      });
      expect(detalle.cambios[0].detalle).toEqual([
        {
          elemento: 'MARTES',
          etiqueta: 'Martes',
          cambios: [
            {
              campo: 'entrada',
              etiqueta: 'Hora de entrada',
              tipo: 'hora',
              antes: '08:00',
              despues: '09:00',
            },
            {
              campo: 'salida',
              etiqueta: 'Hora de salida',
              tipo: 'hora',
              antes: '17:00',
              despues: '18:00',
            },
          ],
        },
      ]);
      expect(detalle.campos_modificados).toEqual(['Horario semanal']);
    });

    it('Debe incluir todos los días del horario en una creación', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        accion: 'CREATE',
        tabla_afectada: 'asistencia_jornada',
        valores_antes: null,
        valores_despues: {
          id: 'j1',
          empleado_id: ID_EMPLEADO,
          jornada_id: ID_JORNADA,
          horario: horarioAntes,
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      const horario = detalle.cambios.find((c) => c.campo === 'horario');
      expect(horario?.detalle?.map((e) => e.etiqueta)).toEqual([
        'Lunes',
        'Martes',
        'Domingo',
      ]);
      expect(horario?.detalle?.[2].cambios).toEqual([
        {
          campo: 'laborable',
          etiqueta: 'Día laborable',
          tipo: 'booleano',
          antes: null,
          despues: 'No',
        },
      ]);
      expect(detalle.cambios.map((c) => c.campo)).not.toContain('empleado_id');
    });

    it('Debe ordenar los campos principales y el horario según la configuración y no según el jsonb', async () => {
      // Arrange: un jsonb ordena sus claves por longitud y alfabéticamente.
      const diaJsonb = (nombre: string) => ({
        dia: nombre,
        salida: '17:00',
        entrada: '08:00',
        laborable: true,
        modalidad: 'PRESENCIAL',
        fin_descanso: '14:00',
        inicio_descanso: '13:00',
      });
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        accion: 'CREATE',
        tabla_afectada: 'asistencia_jornada',
        valores_antes: null,
        valores_despues: {
          desde: '2026-11-01T00:00:00.000Z',
          motivo: 'Nueva jornada',
          horario: [
            'DOMINGO',
            'LUNES',
            'MARTES',
            'MIERCOLES',
            'JUEVES',
            'VIERNES',
            'SABADO',
          ].map(diaJsonb),
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios.map((cambio) => cambio.etiqueta)).toEqual([
        'Vigente desde',
        'Horario semanal',
        'Motivo',
      ]);
      const horario = detalle.cambios.find(
        (cambio) => cambio.campo === 'horario'
      );
      expect(horario?.detalle?.map((elemento) => elemento.etiqueta)).toEqual([
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado',
        'Domingo',
      ]);
      expect(
        horario?.detalle?.[0].cambios.map((cambio) => cambio.etiqueta)
      ).toEqual([
        'Día laborable',
        'Modalidad',
        'Hora de entrada',
        'Hora de salida',
        'Inicio del descanso',
        'Fin del descanso',
      ]);
    });

    it('No debe mostrar el horario si el JSON solo cambió de orden de claves', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        tabla_afectada: 'asistencia_jornada',
        valores_antes: {
          horario: [{ dia: 'LUNES', laborable: true, entrada: '08:00' }],
        },
        valores_despues: {
          horario: [{ entrada: '08:00', dia: 'LUNES', laborable: true }],
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toEqual([]);
    });

    it('Debe mostrar un día agregado o quitado del horario', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        tabla_afectada: 'asistencia_jornada',
        valores_antes: { horario: [dia('LUNES', '08:00', '17:00')] },
        valores_despues: {
          horario: [
            dia('LUNES', '08:00', '17:00'),
            dia('SABADO', '08:00', '12:00'),
          ],
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      const elementos = detalle.cambios[0].detalle ?? [];
      expect(elementos.map((e) => e.etiqueta)).toEqual(['Sábado']);
      expect(elementos[0].cambios[0]).toMatchObject({ antes: null });
    });
  });

  describe('operaciones masivas', () => {
    it('Debe resumir un createMany con la cantidad de registros y el afectado, sin lista de cambios', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        accion: 'CREATEMANY',
        tabla_afectada: 'jornada_area',
        afectado_tipo: 'jornada',
        afectado_id: ID_JORNADA,
        valores_despues: {
          operacion_masiva: 'createMany',
          filtro: null,
          datos: [
            { jornada_id: ID_JORNADA, area_id: ID_AREA },
            { jornada_id: ID_JORNADA, area_id: ID_EMPLEADO },
            { jornada_id: ID_JORNADA, area_id: ID_CARGO_ANTES },
          ],
          registros_afectados: 3,
        },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.accion_etiqueta).toBe('Creación');
      expect(detalle.cambios).toEqual([]);
      expect(detalle.resumen).toBe(
        'Creó 3 registro(s) de Jornadas (Oficina 44 h)'
      );
    });

    it('Debe presentar sin afectado una operación masiva sobre una tabla que usa su propio id, aunque la fila no tenga las columnas', async () => {
      // Arrange
      const { cliente, mock } = crearPrismaSimulado();
      const fila = crearFila({
        accion: 'UPDATEMANY',
        tabla_afectada: 'empleados',
        registro_id: 'id-inventado-por-la-extension',
        afectado_tipo: null,
        afectado_id: null,
        valores_despues: {
          operacion_masiva: 'updateMany',
          filtro: { activo: true },
          datos: { activo: false },
          registros_afectados: 3,
        },
      });

      // Act
      const [resultado] = await presentarActividad(cliente, [fila]);

      // Assert
      expect(resultado.afectado).toBeNull();
      expect(resultado.resumen).toBe('Editó 3 registro(s) de Empleados');
      expect(mock.empleados.findMany).not.toHaveBeenCalled();
    });
  });

  describe('filas viejas de documentos de derechohabientes', () => {
    it('Debe devolver afectado null si la fila no tiene el relleno, en vez de un empleado incompleto', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        accion: 'CREATE',
        tabla_afectada: 'derechohabiente_documentos',
        afectado_tipo: null,
        afectado_id: null,
        valores_despues: {
          id: 'd1',
          derechohabiente_id: ID_DERECHOHABIENTE,
          nombre_archivo: 'partida.pdf',
        },
      });

      // Act
      const [resultado] = await presentarActividad(cliente, [fila]);

      // Assert
      expect(resultado.afectado).toBeNull();
      expect(resultado.resumen).toBe(
        'Subió un documento de Carlos Quispe (hijo menor), familiar de un registro'
      );
    });
  });

  describe('campos protegidos con huella', () => {
    const cuenta = (valor: string | null) => ({
      id: 'df1',
      empleado_id: ID_EMPLEADO,
      sueldo_basico: '2500',
      nro_cuenta_sueldo: valor,
      cuspp: '[OCULTO:aaaaaaaaaa]',
    });

    it('Debe mostrar el cambio como protegido, sin valores ni huellas, si las huellas difieren', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        tabla_afectada: 'dato_financiero',
        valores_antes: cuenta('[OCULTO:1111111111]'),
        valores_despues: cuenta('[OCULTO:2222222222]'),
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toEqual([
        {
          campo: 'nro_cuenta_sueldo',
          etiqueta: 'Cuenta de sueldo',
          tipo: 'texto',
          antes: null,
          despues: null,
          protegido: true,
        },
      ]);
      expect(JSON.stringify(detalle)).not.toMatch(
        /OCULTO|1111111111|2222222222|aaaaaaaaaa/
      );
    });

    it('No debe mostrar cambio si las huellas son iguales', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        tabla_afectada: 'dato_financiero',
        valores_antes: cuenta('[OCULTO:1111111111]'),
        valores_despues: cuenta('[OCULTO:1111111111]'),
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toEqual([]);
    });

    it('Debe seguir sin contar [OCULTO] contra [OCULTO] como cambio', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        tabla_afectada: 'dato_financiero',
        valores_antes: { ...cuenta('[OCULTO]'), cuspp: '[OCULTO]' },
        valores_despues: { ...cuenta('[OCULTO]'), cuspp: '[OCULTO]' },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toEqual([]);
    });

    it('No debe inventar un cambio al comparar un [OCULTO] sin huella con uno que sí la tiene', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        tabla_afectada: 'dato_financiero',
        valores_antes: cuenta('[OCULTO]'),
        valores_despues: cuenta('[OCULTO:2222222222]'),
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toEqual([]);
    });

    it('Debe mostrar como protegido un dato que se agrega o se quita', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        tabla_afectada: 'dato_financiero',
        valores_antes: cuenta(null),
        valores_despues: cuenta('[OCULTO:2222222222]'),
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toHaveLength(1);
      expect(detalle.cambios[0]).toMatchObject({
        campo: 'nro_cuenta_sueldo',
        protegido: true,
        antes: null,
        despues: null,
      });
    });
  });
  describe('plantillas de resumen', () => {
    it.each([
      [
        'Subió un documento de {a} ({b}), familiar de {c}',
        { a: 'Carlos', b: 'hijo menor', c: 'Luis' },
        'Subió un documento de Carlos (hijo menor), familiar de Luis',
      ],
      [
        'Subió un documento de {a} ({b}), familiar de {c}',
        { a: 'Carlos', b: '', c: 'Luis' },
        'Subió un documento de Carlos, familiar de Luis',
      ],
      [
        'Agregó el día {a} ({b}) al calendario',
        { a: 'Navidad', b: '' },
        'Agregó el día Navidad al calendario',
      ],
      [
        'Agregó el día {a} ( {b} ) al calendario',
        { a: 'Navidad', b: '' },
        'Agregó el día Navidad al calendario',
      ],
      ['() Registró a {a}', { a: 'Luis' }, 'Registró a Luis'],
      [
        'Editó a {a} {b}: {c}',
        { a: 'Luis', b: '', c: 'Cargo' },
        'Editó a Luis: Cargo',
      ],
      ['Editó a {a} , {b} .', { a: 'Luis', b: 'Ana' }, 'Editó a Luis, Ana.'],
      ['  Registró   a   {a}  ', { a: 'Luis' }, 'Registró a Luis'],
      ['Sin variables', {}, 'Sin variables'],
    ])('Debe limpiar la plantilla %j', (plantilla, valores, esperado) => {
      // Arrange y Act
      const resultado = rellenarPlantilla(plantilla, valores);

      // Assert
      expect(resultado).toBe(esperado);
    });

    it('Debe mantener tiempo lineal con espacios y paréntesis repetidos', () => {
      // Arrange
      const plantilla = `Edición ${' '.repeat(20000)}(${' '.repeat(20000)}`;

      // Act
      const inicio = Date.now();
      const resultado = rellenarPlantilla(plantilla, {});

      // Assert
      expect(resultado).toBe('Edición (');
      expect(Date.now() - inicio).toBeLessThan(500);
    });

    it('Debe quitar los dos puntos y {campos} cuando una edición no tiene campos modificados', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        tabla_afectada: 'cargo',
        afectado_tipo: 'cargo',
        valores_antes: { id: 'c', nombre: 'Contador', sueldo_minimo: '1130.5' },
        valores_despues: { id: 'c', nombre: 'Contador', sueldo_minimo: 1130.5 },
      });

      // Act
      const [resultado] = await presentarActividad(cliente, [fila]);

      // Assert
      expect(resultado.campos_modificados).toEqual([]);
      expect(resultado.resumen).toBe('Editó el cargo Cargo no disponible');
    });
  });

  describe('montos en soles', () => {
    it.each([
      ['0', 'S/ 0.00'],
      ['12.5', 'S/ 12.50'],
      ['999', 'S/ 999.00'],
      ['1000', 'S/ 1,000.00'],
      ['1234.5', 'S/ 1,234.50'],
      ['2500.5', 'S/ 2,500.50'],
      ['1234567.891', 'S/ 1,234,567.89'],
      ['123456789012.3', 'S/ 123,456,789,012.30'],
      ['-1234.5', '-S/ 1,234.50'],
      ['-0.5', '-S/ 0.50'],
    ])('Debe formatear el sueldo %s como %s', async (valor, esperado) => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = crearFila({
        tabla_afectada: 'cargo',
        afectado_tipo: 'cargo',
        accion: 'CREATE',
        valores_despues: { id: 'c', sueldo_minimo: valor },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios[0]).toMatchObject({
        campo: 'sueldo_minimo',
        tipo: 'moneda',
        despues: esperado,
      });
    });
  });

  describe('detalle diario del resumen de asistencia', () => {
    const diaResultado = (
      fecha: string,
      estado: string,
      extra: Record<string, unknown> = {}
    ) => ({
      fecha,
      estado,
      modalidad: null,
      marcas: [{ tipo: 'ENTRADA', hora: '08:00' }],
      solicitudes: [],
      minutos_programados: 480,
      minutos_trabajados: 480,
      minutos_tardanza: 0,
      minutos_salida_anticipada: 0,
      minutos_sin_goce: 0,
      minutos_extra_observados: 0,
      minutos_extra_25: 0,
      minutos_extra_35: 0,
      falta: 0,
      sin_goce: 0,
      alertas: [],
      ...extra,
    });

    const diasBase = [
      diaResultado('2026-11-01', 'FERIADO_O_DESCANSO_ACORDADO', {
        minutos_trabajados: 0,
      }),
      diaResultado('2026-11-02', 'ASISTENCIA_REGISTRADA'),
    ];

    const filaIncidencias = (
      antes: unknown,
      despues: unknown
    ): FilaAuditoriaActividad =>
      crearFila({
        accion: antes ? 'UPDATE' : 'CREATE',
        tabla_afectada: 'incidencias_mes',
        valores_antes: antes,
        valores_despues: despues,
      });

    it('Debe mostrar los días de una creación con su fecha y estado legibles, sin campos ocultos', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = filaIncidencias(null, {
        id: 'i1',
        empleado_id: ID_EMPLEADO,
        periodo: '2026-11',
        detalle: { version_motor: 'v1', dias: diasBase },
      });

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      const cambio = detalle.cambios.find((c) => c.campo === 'detalle');
      expect(cambio).toMatchObject({
        etiqueta: 'Detalle diario',
        tipo: 'lista',
        antes: null,
        despues: null,
      });
      const elementos = cambio?.detalle ?? [];
      expect(elementos.map((elemento) => elemento.etiqueta)).toEqual([
        '01/11 dom',
        '02/11 lun',
      ]);
      const estados = elementos.map(
        (elemento) =>
          elemento.cambios.find((cambioDia) => cambioDia.campo === 'estado')
            ?.despues
      );
      expect(estados).toEqual(['Feriado o descanso', 'Asistió']);
      for (const elemento of elementos) {
        const campos = elemento.cambios.map((cambioDia) => cambioDia.campo);
        expect(campos).not.toContain('marcas');
        expect(campos).not.toContain('solicitudes');
        expect(campos).not.toContain('minutos_programados');
        expect(campos).not.toContain('minutos_extra_observados');
      }
      expect(detalle.campos_modificados).toContain('Detalle diario');
    });

    it('Debe mostrar un solo día cuando solo cambian su estado y sus minutos', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = filaIncidencias(
        {
          periodo: '2026-11',
          detalle: { version_motor: 'v1', dias: diasBase },
        },
        {
          periodo: '2026-11',
          detalle: {
            version_motor: 'v1',
            dias: [
              diasBase[0],
              diaResultado('2026-11-02', 'MARCACION_INCOMPLETA', {
                minutos_trabajados: 420,
              }),
            ],
          },
        }
      );

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      const cambio = detalle.cambios.find((c) => c.campo === 'detalle');
      const elementos = cambio?.detalle ?? [];
      expect(elementos).toHaveLength(1);
      expect(elementos[0].etiqueta).toBe('02/11 lun');
      expect(elementos[0].cambios).toEqual([
        {
          campo: 'estado',
          etiqueta: 'Estado',
          tipo: 'enum',
          antes: 'Asistió',
          despues: 'Marcación incompleta',
        },
        {
          campo: 'minutos_trabajados',
          etiqueta: 'Min. trabajados',
          tipo: 'numero',
          antes: 480,
          despues: 420,
        },
      ]);
    });

    it('No debe mostrar el detalle si solo cambió el version_motor del resumen', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = filaIncidencias(
        {
          periodo: '2026-11',
          detalle: { version_motor: 'v1', dias: diasBase },
        },
        {
          periodo: '2026-11',
          detalle: { version_motor: 'v2', dias: diasBase },
        }
      );

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      expect(detalle.cambios).toEqual([]);
      expect(detalle.campos_modificados).toEqual([]);
    });

    it('No debe dejar JSON en ningún antes ni después de la respuesta', async () => {
      // Arrange
      const { cliente } = crearPrismaSimulado();
      const fila = filaIncidencias(
        {
          periodo: '2026-11',
          detalle: { version_motor: 'v1', dias: diasBase },
        },
        {
          periodo: '2026-11',
          detalle: {
            version_motor: 'v2',
            dias: [
              diasBase[0],
              diaResultado('2026-11-02', 'MARCACION_INCOMPLETA', {
                minutos_trabajados: 420,
                alertas: ['AUSENCIA_REQUIERE_VERIFICACION'],
              }),
            ],
          },
        }
      );

      // Act
      const detalle = await presentarDetalleActividad(cliente, fila);

      // Assert
      const valores: (string | number | boolean | null)[] = [];
      for (const cambio of detalle.cambios) {
        valores.push(cambio.antes, cambio.despues);
        for (const elemento of cambio.detalle ?? []) {
          for (const cambioDia of elemento.cambios) {
            valores.push(cambioDia.antes, cambioDia.despues);
          }
        }
      }
      expect(valores.length).toBeGreaterThan(0);
      for (const valor of valores) {
        if (valor === null) continue;
        expect(String(valor)).not.toContain('{');
        expect(String(valor)).not.toContain('[');
        expect(String(valor)).not.toContain(']');
        expect(String(valor)).not.toContain('}');
      }
    });
  });

  describe('formato de respaldo de valores compuestos', () => {
    const nombres = crearNombresResueltosVacios();
    const lista = { etiqueta: 'Valores', tipo: 'lista' } as const;

    it('Debe unir un array de textos y humanizar las claves técnicas', () => {
      // Arrange y Act
      const resultado = formatearValorAuditoria(
        lista,
        ['AUSENCIA_REQUIERE_VERIFICACION', 'SIN_GOCE'],
        nombres
      );

      // Assert
      expect(resultado).toBe('Ausencia requiere verificacion, Sin goce');
    });

    it('Debe contar un array de objetos como registros', () => {
      // Arrange y Act
      const dos = formatearValorAuditoria(lista, [{ a: 1 }, { b: 2 }], nombres);
      const uno = formatearValorAuditoria(lista, [{ a: 1 }], nombres);

      // Assert
      expect(dos).toBe('2 registros');
      expect(uno).toBe('1 registro');
    });

    it('Debe describir un objeto con sus valores simples y omitir los anidados', () => {
      // Arrange y Act
      const resultado = formatearValorAuditoria(
        lista,
        { estado: 'APROBADO', dias: 2, marcas: [{ a: 1 }] },
        nombres
      );

      // Assert
      expect(resultado).toBe('Estado: APROBADO · Dias: 2');
    });

    it('Debe usar un texto neutro cuando el objeto solo tiene valores anidados', () => {
      // Arrange y Act
      const resultado = formatearValorAuditoria(
        undefined,
        { marcas: [{ a: 1 }] },
        nombres
      );

      // Assert
      expect(resultado).toBe('Datos actualizados');
    });

    it('Debe devolver null para un array o un objeto vacío', () => {
      // Arrange y Act
      const arreglo = formatearValorAuditoria(lista, [], nombres);
      const objeto = formatearValorAuditoria(lista, {}, nombres);

      // Assert
      expect(arreglo).toBeNull();
      expect(objeto).toBeNull();
    });
  });
});
