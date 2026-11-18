//test/common/utils/campos-relacion.util.spec.ts
import {
  obtenerCamposRelacion,
  quitarCamposRelacion,
  quitarCamposRelacionDatos,
} from '@/common/utils/campos-relacion.util';

describe('campos-relacion.util (usa el modelo de datos real de Prisma)', () => {
  it('Debe detectar como relaciones solo los campos kind object del modelo', () => {
    // Arrange y Act
    const empleados = obtenerCamposRelacion('empleados');

    // Assert
    expect(empleados.has('area')).toBe(true);
    expect(empleados.has('cargo')).toBe(true);
    expect(empleados.has('area_id')).toBe(false);
    expect(empleados.has('estado_laboral')).toBe(false);
  });

  it('No debe tratar como relación una columna Json escalar como horario', () => {
    // Arrange y Act
    const jornada = obtenerCamposRelacion('asistencia_jornada');

    // Assert
    expect(jornada.has('horario')).toBe(false);
    expect(jornada.has('empleado')).toBe(true);
  });

  it('Debe devolver un conjunto vacío para un modelo desconocido', () => {
    // Arrange y Act y Assert
    expect(obtenerCamposRelacion('tabla_que_no_existe').size).toBe(0);
  });

  it('Debe quitar las relaciones de una fila sin modificar el original', () => {
    // Arrange
    const fila = {
      id: 'e1',
      estado_laboral: 'LICENCIA',
      area: { id: 'a1', nombre: 'Contabilidad' },
      cargo: { id: 'c1', nombre: 'Contador' },
    };

    // Act
    const limpia = quitarCamposRelacion('empleados', fila);

    // Assert
    expect(limpia).toEqual({ id: 'e1', estado_laboral: 'LICENCIA' });
    expect(fila.area).toEqual({ id: 'a1', nombre: 'Contabilidad' });
  });

  it('Debe conservar los Json escalares y devolver igual lo que no es una fila', () => {
    // Arrange
    const fila = {
      id: 'j1',
      horario: [{ dia: 'LUNES' }],
      empleado: { id: 'e1' },
    };

    // Act y Assert
    expect(quitarCamposRelacion('asistencia_jornada', fila)).toEqual({
      id: 'j1',
      horario: [{ dia: 'LUNES' }],
    });
    expect(quitarCamposRelacion('empleados', null)).toBeNull();
    expect(quitarCamposRelacion('empleados', 'texto')).toBe('texto');
  });

  it('Debe quitar relaciones anidadas (connect, create) de los datos de una operación masiva', () => {
    // Arrange
    const datos = [
      { jornada_id: 'j1', area_id: 'a1', area: { connect: { id: 'a1' } } },
      { jornada_id: 'j1', area_id: 'a2', jornada: { connect: { id: 'j1' } } },
    ];

    // Act
    const limpios = quitarCamposRelacionDatos('jornada_area', datos);

    // Assert
    expect(limpios).toEqual([
      { jornada_id: 'j1', area_id: 'a1' },
      { jornada_id: 'j1', area_id: 'a2' },
    ]);
    expect(
      quitarCamposRelacionDatos('empleados', {
        nombre: 'Luis',
        cargo: { connect: { id: 'c1' } },
      })
    ).toEqual({ nombre: 'Luis' });
    expect(quitarCamposRelacionDatos('empleados', null)).toBeNull();
  });
});
