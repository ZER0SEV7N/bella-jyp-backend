//test/modules/core/audit/helpers/resolver-afectado-auditoria.helper.spec.ts
import {
  TABLAS_AUDITORIA,
  TABLAS_PERMITIDAS_RRHH,
} from '@/modules/core/audit/config/auditoria-tablas.config';
import {
  extraerAfectadoAuditoria,
  resolverAfectadoAuditoria,
} from '@/modules/core/audit/helpers/resolver-afectado-auditoria.helper';

const ID_REGISTRO = '0192a000-0000-7000-8000-000000000010';
const ID_EMPLEADO = '0192a000-0000-7000-8000-000000000001';
const ID_AREA = '0192a000-0000-7000-8000-0000000000a1';
const ID_JORNADA = '0192a000-0000-7000-8000-0000000000f1';
const ID_DERECHOHABIENTE = '0192a000-0000-7000-8000-0000000000dd';

describe('extraerAfectadoAuditoria', () => {
  it.each(['empleados'])(
    'Debe usar el registro_id como empleado en %s',
    (tabla) => {
      // Arrange y Act
      const afectado = extraerAfectadoAuditoria(tabla, ID_REGISTRO, null, {
        id: ID_REGISTRO,
      });

      // Assert
      expect(afectado).toEqual({ tipo: 'empleado', id: ID_REGISTRO });
    }
  );

  it.each([
    ['area', 'area'],
    ['cargo', 'cargo'],
    ['jornada', 'jornada'],
  ])('Debe usar el registro_id como %s en la tabla %s', (tipo, tabla) => {
    // Arrange y Act
    const afectado = extraerAfectadoAuditoria(tabla, ID_REGISTRO, null, {
      id: ID_REGISTRO,
    });

    // Assert
    expect(afectado).toEqual({ tipo, id: ID_REGISTRO });
  });

  it.each([
    'contratos',
    'derechohabientes',
    'dato_financiero',
    'solicitud',
    'asistencia_marcacion',
    'asistencia_jornada',
    'asistencia_decision',
    'incidencias_mes',
  ])('Debe leer empleado_id de valores_despues en %s', (tabla) => {
    // Arrange y Act
    const afectado = extraerAfectadoAuditoria(tabla, ID_REGISTRO, null, {
      id: ID_REGISTRO,
      empleado_id: ID_EMPLEADO,
    });

    // Assert
    expect(afectado).toEqual({ tipo: 'empleado', id: ID_EMPLEADO });
  });

  it('Debe leer empleado_id de valores_antes cuando la fila se eliminó y no hay valores_despues', () => {
    // Arrange y Act
    const afectado = extraerAfectadoAuditoria(
      'contratos',
      ID_REGISTRO,
      { empleado_id: ID_EMPLEADO },
      null
    );

    // Assert
    expect(afectado).toEqual({ tipo: 'empleado', id: ID_EMPLEADO });
  });

  it('Debe atribuir jornada_area a la jornada por jornada_id', () => {
    // Arrange y Act
    const afectado = extraerAfectadoAuditoria(
      'jornada_area',
      ID_REGISTRO,
      null,
      { jornada_id: ID_JORNADA, area_id: ID_AREA }
    );

    // Assert
    expect(afectado).toEqual({ tipo: 'jornada', id: ID_JORNADA });
  });

  it('Debe leer la jornada de un createMany con varias áreas y de un deleteMany por filtro', () => {
    // Arrange
    const crearMasivo = {
      operacion_masiva: 'createMany',
      filtro: null,
      datos: [
        { jornada_id: ID_JORNADA, area_id: ID_AREA },
        { jornada_id: ID_JORNADA, area_id: ID_EMPLEADO },
      ],
    };
    const borrarMasivo = {
      operacion_masiva: 'deleteMany',
      filtro: { jornada_id: ID_JORNADA },
      datos: null,
    };

    // Act y Assert
    expect(
      extraerAfectadoAuditoria('jornada_area', ID_REGISTRO, null, crearMasivo)
    ).toEqual({ tipo: 'jornada', id: ID_JORNADA });
    expect(
      extraerAfectadoAuditoria('jornada_area', ID_REGISTRO, null, borrarMasivo)
    ).toEqual({ tipo: 'jornada', id: ID_JORNADA });
  });

  it('No debe elegir afectado cuando una operación masiva mezcla varias jornadas', () => {
    // Arrange
    const masivo = {
      operacion_masiva: 'createMany',
      datos: [{ jornada_id: ID_JORNADA }, { jornada_id: ID_EMPLEADO }],
    };

    // Act
    const afectado = extraerAfectadoAuditoria(
      'jornada_area',
      ID_REGISTRO,
      null,
      masivo
    );

    // Assert
    expect(afectado).toBeNull();
  });

  it.each(['empleados', 'area', 'cargo', 'jornada'])(
    'No debe usar el registro_id inventado de una operación masiva en %s',
    (tabla) => {
      // Arrange
      const masivo = {
        operacion_masiva: 'updateMany',
        filtro: { activo: true },
        datos: { activo: false },
        registros_afectados: 3,
      };

      // Act
      const afectado = extraerAfectadoAuditoria(
        tabla,
        ID_REGISTRO,
        null,
        masivo
      );

      // Assert
      expect(afectado).toBeNull();
    }
  );

  it('Debe atribuir el calendario laboral a la empresa, sin id', () => {
    // Arrange y Act
    const afectado = extraerAfectadoAuditoria(
      'asistencia_calendario',
      ID_REGISTRO,
      null,
      { id: ID_REGISTRO }
    );

    // Assert
    expect(afectado).toEqual({ tipo: 'empresa', id: null });
  });

  it('Debe devolver null si la tabla no está configurada o la fila no trae el campo', () => {
    // Arrange y Act y Assert
    expect(
      extraerAfectadoAuditoria('usuarios', ID_REGISTRO, null, {
        id: ID_REGISTRO,
      })
    ).toBeNull();
    expect(
      extraerAfectadoAuditoria('contratos', ID_REGISTRO, null, {
        id: ID_REGISTRO,
      })
    ).toBeNull();
  });

  it('Debe pedir el derechohabiente en los documentos, sin consultar todavía', () => {
    // Arrange y Act
    const afectado = extraerAfectadoAuditoria(
      'derechohabiente_documentos',
      ID_REGISTRO,
      null,
      { derechohabiente_id: ID_DERECHOHABIENTE }
    );

    // Assert
    expect(afectado).toEqual({
      tipo: 'empleado',
      id: null,
      derechohabienteId: ID_DERECHOHABIENTE,
    });
  });
});

describe('resolverAfectadoAuditoria', () => {
  it('Debe resolver con una consulta extra el empleado de un documento de derechohabiente', async () => {
    // Arrange
    const buscarEmpleado = jest.fn().mockResolvedValue(ID_EMPLEADO);

    // Act
    const afectado = await resolverAfectadoAuditoria(
      'derechohabiente_documentos',
      ID_REGISTRO,
      null,
      { derechohabiente_id: ID_DERECHOHABIENTE },
      buscarEmpleado
    );

    // Assert
    expect(afectado).toEqual({ tipo: 'empleado', id: ID_EMPLEADO });
    expect(buscarEmpleado).toHaveBeenCalledTimes(1);
    expect(buscarEmpleado).toHaveBeenCalledWith(ID_DERECHOHABIENTE);
  });

  it('Debe devolver null si el derechohabiente ya no existe', async () => {
    // Arrange
    const buscarEmpleado = jest.fn().mockResolvedValue(null);

    // Act
    const afectado = await resolverAfectadoAuditoria(
      'derechohabiente_documentos',
      ID_REGISTRO,
      { derechohabiente_id: ID_DERECHOHABIENTE },
      null,
      buscarEmpleado
    );

    // Assert
    expect(afectado).toBeNull();
  });

  it('No debe hacer la consulta extra en las tablas que traen el afectado en la fila', async () => {
    // Arrange
    const buscarEmpleado = jest.fn();

    // Act
    const afectado = await resolverAfectadoAuditoria(
      'contratos',
      ID_REGISTRO,
      null,
      { empleado_id: ID_EMPLEADO },
      buscarEmpleado
    );

    // Assert
    expect(afectado).toEqual({ tipo: 'empleado', id: ID_EMPLEADO });
    expect(buscarEmpleado).not.toHaveBeenCalled();
  });
});

describe('configuración de tablas auditadas', () => {
  const LISTA_FIJA_RRHH = [
    'area',
    'cargo',
    'jornada',
    'jornada_area',
    'empleados',
    'contratos',
    'derechohabientes',
    'derechohabiente_documentos',
    'dato_financiero',
    'solicitud',
    'asistencia_marcacion',
    'asistencia_jornada',
    'asistencia_decision',
    'asistencia_calendario',
    'incidencias_mes',
  ];

  it('Debe mantener la lista fija de las 15 tablas visibles para RRHH', () => {
    // Arrange y Act y Assert
    expect([...TABLAS_PERMITIDAS_RRHH]).toEqual(LISTA_FIJA_RRHH);
  });

  it('Debe tener configuración, con afectado, módulo y resumen, para toda tabla de la lista de RRHH', () => {
    // Arrange y Act y Assert
    for (const tabla of TABLAS_PERMITIDAS_RRHH) {
      const config = TABLAS_AUDITORIA[tabla];
      expect(config).toBeDefined();
      expect(config.moduloEtiqueta).toBeTruthy();
      expect(config.resumen.CREACION).toBeTruthy();
      if (
        config.afectado.origen === 'campo' ||
        config.afectado.origen === 'derechohabiente'
      ) {
        expect(config.campos[config.afectado.campo ?? '']).toBeDefined();
      }
    }
  });

  it('No debe abrir a RRHH una tabla solo por tener configuración (la lista no se deriva de la config)', () => {
    // Arrange: una tabla configurada que no está en la lista fija de RRHH.
    TABLAS_AUDITORIA.tabla_solo_admin = {
      moduloEtiqueta: 'Prueba',
      afectado: { tipo: 'empresa', origen: 'ninguno' },
      campos: {},
      resumen: {},
    };

    // Act y Assert
    expect(TABLAS_PERMITIDAS_RRHH as readonly string[]).not.toContain(
      'tabla_solo_admin'
    );
    delete TABLAS_AUDITORIA.tabla_solo_admin;
  });
});
