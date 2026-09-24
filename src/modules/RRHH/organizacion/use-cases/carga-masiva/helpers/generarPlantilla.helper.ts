//src/modules/RRHH/organizacion/use-cases/carga-masiva/helpers/generarPlantilla.helper.ts
import * as ExcelJS from 'exceljs';

/**
 * Genera una plantilla de Excel para la carga masiva de empleados.
 * La plantilla incluye columnas predefinidas con ejemplos de datos para facilitar la carga de información.
 * @async - Función asíncrona que devuelve un Buffer con el contenido del archivo Excel generado.
 * @returns - Promesa que se resuelve con un Buffer que contiene el archivo Excel listo para ser descargado o enviado.
 */
export async function generarPlantillaExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JYP Planillas';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Plantilla Empleados', {views: [{ showGridLines: true }]});

  sheet.columns = [
    //1. Identificación y Filiación
    { header: 'tipo_documento', key: 'tipo_documento', width: 16 },
    { header: 'nro_documento', key: 'nro_documento', width: 18 },
    { header: 'nombre', key: 'nombre', width: 22 },
    { header: 'apellido', key: 'apellido', width: 24 },
    { header: 'sexo', key: 'sexo', width: 14 },
    { header: 'estado_civil', key: 'estado_civil', width: 16 },
    { header: 'fecha_nacimiento', key: 'fecha_nacimiento', width: 18 },

    //2. Contacto y Domicilio (Fiscalización)
    { header: 'email', key: 'email', width: 28 },
    { header: 'telefono', key: 'telefono', width: 16 },
    { header: 'direccion', key: 'direccion', width: 34 },
    { header: 'departamento', key: 'departamento', width: 18 },
    { header: 'provincia', key: 'provincia', width: 18 },
    { header: 'distrito', key: 'distrito', width: 18 },
    { header: 'ubigeo', key: 'ubigeo', width: 14 },

    //3. Vínculo Organizacional
    { header: 'fecha_inicio', key: 'fecha_inicio', width: 16 },
    { header: 'asig_familiar', key: 'asig_familiar', width: 15 },
    { header: 'area', key: 'area', width: 26 },
    { header: 'cargo', key: 'cargo', width: 26 },
    { header: 'jornada', key: 'jornada', width: 26 },

    //4. Datos Económicos y Previsión
    { header: 'sueldo_basico', key: 'sueldo_basico', width: 16 },
    { header: 'regimen_pension', key: 'regimen_pension', width: 18 },
    { header: 'tipo_afp', key: 'tipo_afp', width: 16 },
    { header: 'cuspp', key: 'cuspp', width: 18 },
    { header: 'tipo_comision', key: 'tipo_comision', width: 16 },

    //5. Cuentas de Sueldo
    { header: 'banco_sueldo', key: 'banco_sueldo', width: 16 },
    { header: 'tipo_cuenta_sueldo', key: 'tipo_cuenta_sueldo', width: 20 },
    { header: 'nro_cuenta_sueldo', key: 'nro_cuenta_sueldo', width: 24 },
    { header: 'cci_sueldo', key: 'cci_sueldo', width: 26 },

    //6. Cuentas de CTS
    { header: 'banco_cts', key: 'banco_cts', width: 16 },
    { header: 'tipo_cuenta_cts', key: 'tipo_cuenta_cts', width: 18 },
    { header: 'nro_cuenta_cts', key: 'nro_cuenta_cts', width: 24 },
    { header: 'cci_cts', key: 'cci_cts', width: 26 },

    //7. Salud
    { header: 'regimen_salud', key: 'regimen_salud', width: 20 },
    { header: 'eps_costo_adicional', key: 'eps_costo_adicional', width: 20 },
  ];

  //Formatear la fila de encabezado con estilo y color de fondo
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F497D' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  //Agregar filas de ejemplo para ilustrar cómo llenar la plantilla
  const filasEjemplo = [{
      tipo_documento: 'DNI',
      nro_documento: '70122334',
      nombre: 'Carlos',
      apellido: 'Ramírez Silva',
      sexo: 'MASCULINO',
      estado_civil: 'CASADO',
      fecha_nacimiento: '1988-06-15',
      email: 'contador@jyp.com',
      telefono: '987654321',
      direccion: 'Av. Las Camelias 450 Dpto 302',
      departamento: 'LIMA',
      provincia: 'LIMA',
      distrito: 'SAN ISIDRO',
      ubigeo: '150131',
      fecha_inicio: '2024-02-01',
      asig_familiar: 'SI',
      area: 'Contabilidad y Finanzas',
      cargo: 'Contador Principal',
      jornada: 'Jornada Estándar Oficina',
      sueldo_basico: 3500.0,
      regimen_pension: 'AFP',
      tipo_afp: 'INTEGRA',
      cuspp: '123456CRM001',
      tipo_comision: 'FLUJO',
      banco_sueldo: 'BCP',
      tipo_cuenta_sueldo: 'SUELDO',
      nro_cuenta_sueldo: '191-12345678-0-12',
      cci_sueldo: '002-191-00123456780123-88',
      banco_cts: 'BBVA',
      tipo_cuenta_cts: 'AHORROS',
      nro_cuenta_cts: '0011-0123-45-0100012345',
      cci_cts: '011-123-000100012345-67',
      regimen_salud: 'ESSALUD_REGULAR',
      eps_costo_adicional: 0
    },
    {
      tipo_documento: 'CE',
      nro_documento: '001155998',
      nombre: 'Miguel Ángel',
      apellido: 'Osorio Díaz',
      sexo: 'MASCULINO',
      estado_civil: 'SOLTERO',
      fecha_nacimiento: '1985-11-30',
      email: 'miguel.osorio@jyp.com',
      telefono: '912345678',
      direccion: 'Jr. Los Álamos 124',
      departamento: 'LIMA',
      provincia: 'LIMA',
      distrito: 'SURQUILLO',
      ubigeo: '150141',
      fecha_inicio: '2024-05-01',
      asig_familiar: 'NO',
      area: 'Seguridad y Operaciones',
      cargo: 'Vigilante Nocturno',
      jornada: 'Turno Nocturno Seguridad',
      sueldo_basico: 1800.0,
      regimen_pension: 'ONP',
      tipo_afp: '',
      cuspp: '',
      tipo_comision: '',
      banco_sueldo: 'INTERBANK',
      tipo_cuenta_sueldo: 'SUELDO',
      nro_cuenta_sueldo: '200-3001234567',
      cci_sueldo: '003-200-00300123456789-11',
      banco_cts: 'INTERBANK',
      tipo_cuenta_cts: 'AHORROS',
      nro_cuenta_cts: '200-3009876543',
      cci_cts: '003-200-00300987654321-22',
      regimen_salud: 'EPS',
      eps_costo_adicional: 45.5
    }
  ];

  filasEjemplo.forEach((data) => {
    const row = sheet.addRow(data);
    [
      'nro_documento',
      'telefono',
      'ubigeo',
      'nro_cuenta_sueldo',
      'cci_sueldo',
      'nro_cuenta_cts',
      'cci_cts',
      'cuspp'
    ].forEach((key) => { row.getCell(key).numFmt = '@'; });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}