const ExcelJS = require('exceljs');
const fs = require('fs');
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Marcaciones');
  ws.addRow(['nro_documento','fecha','hora','tipo_marcacion']);
  ws.addRow(['72345678','2026-05-10','08:00:00','ENTRADA']);
  const buf = await wb.xlsx.writeBuffer();
  fs.writeFileSync('tmp-repro.xlsx', Buffer.from(buf));
  for (const opts of [
    { sharedStrings: 'cache', worksheets: 'emit', styles: 'ignore', hyperlinks: 'ignore' },
    { sharedStrings: 'cache', worksheets: 'emit' },
    { sharedStrings: 'cache', worksheets: 'emit', styles: 'cache' },
  ]) {
    try {
      const reader = new ExcelJS.stream.xlsx.WorkbookReader('tmp-repro.xlsx', opts);
      let rows = 0;
      for await (const sheet of reader) { for await (const row of sheet) rows++; }
      console.log('OK', JSON.stringify(opts), 'rows=' + rows);
    } catch (e) { console.log('ERR', JSON.stringify(opts), e.message); }
  }
})();
