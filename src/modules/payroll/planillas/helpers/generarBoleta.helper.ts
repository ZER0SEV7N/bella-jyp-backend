const PdfPrinter = require('pdfmake');
import { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import * as fs from 'fs';
import * as path from 'path';
import { Decimal } from '@prisma/client/runtime/client';

// ---------- Tipos de entrada ----------

export interface EmpresaData {
  nombreEmpresa?: string | null;
  ruc?: string | null;
  direccion?: string | null;
}

export interface CabezalEmpleado {
  nombre_completo: string;
  nro_documento: string;
  cargo: string;
  area: string;
  asignacion_familiar: boolean;
  dias_laborados: number;
  regimen_pension: string;
}

// Aceptamos number | string | null para no depender de Prisma.Decimal
type Amount = number | Decimal | string | null | undefined;

export interface IngresosEmpleado {
  sueldo_base: Amount;
  asignacion_familia: Amount;
  horas_extras_25: Amount;
  horas_extras_35: Amount;
  recargo_nocturno: Amount;
  gratificacion: Amount;
  bonif_extraordinaria: Amount;
}

export interface DescuentosEmpleado {
  descuento_faltas: Amount;
  descuento_tardanzas: Amount;
  descuento_quinta: Amount;
  descuento_adelanto: Amount;
  descuento_eps: Amount;
}

export interface AportacionesEmpleado {
  descuento_onp: Amount;
  descuento_afp_fondo: Amount;
  descuento_afp_seguro: Amount;
  descuento_afp_comision: Amount;
  tasa_afp_aplicada: Amount;
}

export interface AportesEmpleador {
  aporte_essalud: Amount;
  aporte_vida_ley: Amount;
}

export interface TotalesPlanilla {
  total_ingresos: Amount;
  total_descuentos: Amount;
  neto_a_pagar: Amount;
}

export interface PeriodoPlanilla {
  periodo: string; // 'YYYY-MM'
}

// ---------- Formateadores ----------

const formatAmount = (val: Amount): string => {
  if (val === undefined || val === null) return '0.00';
  if (val instanceof Decimal) {
    return val.toFixed(2);
  }
  const num = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

const formatPercentage = (val: Amount): string => {
  if (val === undefined || val === null) return 'N/A';
  const num = val instanceof Decimal ? val.toNumber() : Number(val);
  if (isNaN(num) || num === 0) return 'N/A';
  const percentage = num < 1 ? num * 100 : num;
  return `${percentage.toFixed(2)}%`;
};
// ---------- Fuentes ----------

const fonts = {
  Roboto: {
    normal: path.join(__dirname, '..', 'fonts', 'Roboto-Regular.ttf'),
    bold: path.join(__dirname, '..', 'fonts', 'Roboto-Medium.ttf'),
    italics: path.join(__dirname, '..', 'fonts', 'Roboto-Italic.ttf'),
    bolditalics: path.join(__dirname, '..', 'fonts', 'Roboto-MediumItalic.ttf'),
  },
};

const printer = new PdfPrinter(fonts);

// ---------- Función principal ----------

export const generateBoletaPdf = async (
  empresa: EmpresaData,
  cabezal: CabezalEmpleado,
  ingresos: IngresosEmpleado,
  descuentos: DescuentosEmpleado,
  aportaciones: AportacionesEmpleado,
  aportesEmpleador: AportesEmpleador,
  totales: TotalesPlanilla,
  periodoData: PeriodoPlanilla,
  outputPath: string,
): Promise<string> => {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    try {
      const nombreEmpresaText = empresa.nombreEmpresa ?? 'J&P PERIFERICOS S.A.C.';
      const rucText = empresa.ruc ?? '----- RUC EMPRESA -----';
      const direccionText = empresa.direccion ?? '----- DIRECCIÓN EMPRESA -----';

      const nombreTrabajador = cabezal.nombre_completo || 'TRABAJADOR NO REGISTRADO';
      const dniTrabajador = cabezal.nro_documento || '--------';
      const cargoTrabajador = cabezal.cargo || 'NO ESPECIFICADO';
      const regimenTrabajador = cabezal.regimen_pension || 'NO ESPECIFICADO';

      const isONP =
        regimenTrabajador.toUpperCase().includes('ONP') ||
        (aportaciones.tasa_afp_aplicada === null &&
          Number(aportaciones.descuento_onp) > 0);

      // ----- Descuentos dinámicos -----
      const listaDescuentos: Array<[string, string]> = [
        ['Descuento Faltas', formatAmount(descuentos.descuento_faltas)],
        ['Descuento Tardanzas', formatAmount(descuentos.descuento_tardanzas)],
      ];

      if (isONP) {
        listaDescuentos.push(['Descuento ONP', formatAmount(aportaciones.descuento_onp)]);
      } else {
        listaDescuentos.push([
          'Descuento AFP Fondo (10%)',
          formatAmount(aportaciones.descuento_afp_fondo),
        ]);
        listaDescuentos.push([
          'Descuento AFP Seguro',
          formatAmount(aportaciones.descuento_afp_seguro),
        ]);
        listaDescuentos.push([
          'Descuento AFP Comisión',
          formatAmount(aportaciones.descuento_afp_comision),
        ]);
      }

      listaDescuentos.push(['Descuento Quinta Categoría', formatAmount(descuentos.descuento_quinta)]);
      listaDescuentos.push(['Descuento Adelanto de Sueldo', formatAmount(descuentos.descuento_adelanto)]);
      listaDescuentos.push(['Descuento EPS', formatAmount(descuentos.descuento_eps)]);

      // ----- Ingresos -----
      const listaIngresos: Array<[string, string]> = [
        ['Sueldo Base', formatAmount(ingresos.sueldo_base)],
        ['Asignación Familiar', formatAmount(ingresos.asignacion_familia)],
        ['Horas Extras 25%', formatAmount(ingresos.horas_extras_25)],
        ['Horas Extras 35%', formatAmount(ingresos.horas_extras_35)],
        ['Recargo Nocturno', formatAmount(ingresos.recargo_nocturno)],
        ['Gratificación', formatAmount(ingresos.gratificacion)],
        ['Bonificación Extraordinaria', formatAmount(ingresos.bonif_extraordinaria)],
      ];

      const maxRows = Math.max(listaIngresos.length, listaDescuentos.length);
      const tableBody: TableCell[][] = [
        [
          { text: '1. INGRESOS (REMUNERACIONES)', style: 'tableHeader', colSpan: 2 },
          {},
          { text: '2. DESCUENTOS AL TRABAJADOR', style: 'tableHeader', colSpan: 2 },
          {},
        ],
        [
          { text: 'Concepto', style: 'subSectionHeader' },
          { text: 'Monto (S/)', style: 'subSectionHeader', alignment: 'right' },
          { text: 'Concepto', style: 'subSectionHeader' },
          { text: 'Monto (S/)', style: 'subSectionHeader', alignment: 'right' },
        ],
      ];

      for (let i = 0; i < maxRows; i++) {
        const ing = listaIngresos[i] || ['', ''];
        const desc = listaDescuentos[i] || ['', ''];
        tableBody.push([
          { text: ing[0] },
          { text: ing[1] ? ing[1] : '', alignment: 'right' },
          { text: desc[0] },
          { text: desc[1] ? desc[1] : '', alignment: 'right' },
        ]);
      }

      tableBody.push([
        { text: 'TOTAL INGRESOS', style: 'totalRow' },
        {
          text: `S/ ${formatAmount(totales.total_ingresos)}`,
          style: 'totalRow',
          alignment: 'right',
        },
        { text: 'TOTAL DESCUENTOS', style: 'totalRow' },
        {
          text: `S/ ${formatAmount(totales.total_descuentos)}`,
          style: 'totalRow',
          alignment: 'right',
        },
      ]);

      // ----- Documento -----
      const docDefinition: TDocumentDefinitions = {
        pageSize: 'A4',
        pageMargins: [30, 30, 30, 30],
        defaultStyle: { font: 'Roboto', fontSize: 8, color: '#1a1a1a' },
        styles: {
          companyTitle: { fontSize: 11, bold: true, color: '#1a2a3a' },
          companySubtitle: { fontSize: 8, color: '#555555', margin: [0, 2, 0, 8] },
          docTitle: { fontSize: 11, bold: true, alignment: 'center', color: '#1a2a3a' },
          docPeriod: {
            fontSize: 9,
            bold: true,
            alignment: 'center',
            margin: [0, 2, 0, 8],
            color: '#2c3e50',
          },
          tableHeader: {
            bold: true,
            fillColor: '#2c3e50',
            color: '#ffffff',
            alignment: 'center',
            fontSize: 8,
          },
          subSectionHeader: {
            bold: true,
            fillColor: '#e9ecef',
            color: '#2c3e50',
            fontSize: 8,
          },
          label: { bold: true, fillColor: '#f8f9fa', fontSize: 7.5 },
          value: { fontSize: 8 },
          totalRow: { bold: true, fillColor: '#f1f3f5' },
          netPayBox: {
            bold: true,
            fillColor: '#d1e7dd',
            color: '#0f5132',
            fontSize: 9,
            alignment: 'center',
          },
          footerText: { fontSize: 7, color: '#777777', alignment: 'center' },
        },
        content: [
          { text: nombreEmpresaText, style: 'companyTitle' },
          { text: `RUC: ${rucText} | Dir: ${direccionText}`, style: 'companySubtitle' },
          {
            canvas: [
              { type: 'line', x1: 0, y1: 0, x2: 535, y2: 0, lineWidth: 1, lineColor: '#2c3e50' },
            ],
          },
          { text: '', margin: [0, 4, 0, 0] },

          {
            table: {
              widths: ['34%', '33%', '33%'],
              body: [
                [
                  { text: 'TRABAJADOR', style: 'label' },
                  { text: 'DNI / DOCUMENTO', style: 'label' },
                  { text: 'CARGO', style: 'label' },
                ],
                [
                  { text: nombreTrabajador, style: 'value' },
                  { text: dniTrabajador, style: 'value' },
                  { text: cargoTrabajador, style: 'value' },
                ],
                [
                  { text: 'DÍAS LABORADOS', style: 'label' },
                  { text: 'RÉGIMEN PENSIONARIO', style: 'label' },
                  { text: 'TASA AFP APLICADA', style: 'label' },
                ],
                [
                  { text: `${cabezal.dias_laborados} días`, style: 'value' },
                  { text: regimenTrabajador, style: 'value' },
                  {
                    text: isONP
                      ? 'N/A'
                      : formatPercentage(aportaciones.tasa_afp_aplicada),
                    style: 'value',
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#cccccc',
              vLineColor: () => '#cccccc',
            },
          },

          { text: '', margin: [0, 6, 0, 0] },
          { text: 'BOLETA DE PAGO', style: 'docTitle' },
          { text: `PERIODO: ${periodoData.periodo}`, style: 'docPeriod' },

          {
            table: {
              widths: ['35%', '15%', '35%', '15%'],
              body: tableBody,
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#dddddd',
              vLineColor: () => '#dddddd',
            },
          },

          { text: '', margin: [0, 8, 0, 0] },

          {
            table: {
              widths: ['50%', '25%', '25%'],
              body: [
                [
                  {
                    text: '3. APORTACIONES DEL EMPLEADOR (INFORMATIVO)',
                    style: 'tableHeader',
                    colSpan: 3,
                  },
                  {},
                  {},
                ],
                [
                  { text: 'Concepto', style: 'subSectionHeader' },
                  { text: 'Base Imponible', style: 'subSectionHeader', alignment: 'right' },
                  { text: 'Monto (S/)', style: 'subSectionHeader', alignment: 'right' },
                ],
                [
                  { text: 'Aporte EsSalud (9%)' },
                  {
                    text: `S/ ${formatAmount(totales.total_ingresos)}`,
                    alignment: 'right',
                  },
                  { text: formatAmount(aportesEmpleador.aporte_essalud), alignment: 'right' },
                ],
                [
                  { text: 'Aporte Seguro Vida Ley' },
                  {
                    text: `S/ ${formatAmount(totales.total_ingresos)}`,
                    alignment: 'right',
                  },
                  { text: formatAmount(aportesEmpleador.aporte_vida_ley), alignment: 'right' },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#dddddd',
              vLineColor: () => '#dddddd',
            },
          },

          { text: '', margin: [0, 8, 0, 0] },

          {
            table: {
              widths: ['33%', '33%', '34%'],
              body: [
                [
                  { text: 'TOTAL INGRESOS', style: 'label', alignment: 'center' },
                  { text: 'TOTAL DESCUENTOS', style: 'label', alignment: 'center' },
                  { text: 'NETO A PAGAR', style: 'label', alignment: 'center' },
                ],
                [
                  {
                    text: `S/ ${formatAmount(totales.total_ingresos)}`,
                    alignment: 'center',
                    bold: true,
                  },
                  {
                    text: `S/ ${formatAmount(totales.total_descuentos)}`,
                    alignment: 'center',
                    bold: true,
                  },
                  {
                    text: `S/ ${formatAmount(totales.neto_a_pagar)}`,
                    style: 'netPayBox',
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#cccccc',
              vLineColor: () => '#cccccc',
            },
          },

          { text: '', margin: [0, 35, 0, 0] },

          {
            columns: [
              {
                stack: [
                  { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 200, y2: 0, lineWidth: 1 }] },
                  {
                    text: nombreEmpresaText,
                    bold: true,
                    alignment: 'center',
                    margin: [0, 4, 0, 0],
                  },
                  { text: 'Firma del Empleador', alignment: 'center', fontSize: 7.5 },
                ],
              },
              {
                stack: [
                  { canvas: [{ type: 'line', x1: 20, y1: 0, x2: 200, y2: 0, lineWidth: 1 }] },
                  {
                    text: nombreTrabajador,
                    bold: true,
                    alignment: 'center',
                    margin: [0, 4, 0, 0],
                  },
                  { text: 'Firma del Trabajador / Recibí Conforme', alignment: 'center', fontSize: 7.5 },
                ],
              },
            ],
          },

          { text: '', margin: [0, 15, 0, 0] },
          {
            text: 'Documento generado según DS N° 001-98-TR y normas SUNAT',
            style: 'footerText',
          },
        ],
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const writeStream = fs.createWriteStream(outputPath);

      pdfDoc.pipe(writeStream);
      pdfDoc.end();

      writeStream.on('finish', () => resolve(outputPath));
      writeStream.on('error', (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
};