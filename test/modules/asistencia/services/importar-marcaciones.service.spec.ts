import { ImportarMarcacionesService } from '@/modules/asistencia/services/importar-marcaciones.service';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
  transaccionAuditada: jest.fn((_p, _a, fn) => fn(_p)),
  bloquearEmpleado: jest.fn(),
}));
jest.mock('@/modules/asistencia/helpers/periodo-editable.helper', () => ({
  validarPeriodoEditable: jest.fn(),
}));
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('ImportarMarcacionesService', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = {
    asistencia_marcacion: { findMany: jest.fn(), createMany: jest.fn() },
  };
  const caso = new ImportarMarcacionesService(prisma as never);
  it('omite duplicados ya persistidos sin reinserción', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.asistencia_marcacion.findMany.mockResolvedValue([
      {
        empleado_id: 'e',
        fecha_hora: new Date('2026-09-01T14:00:00Z'),
        tipo_marcacion: 'ENTRADA',
      },
    ]);
    const preparada = {
      filas: [
        {
          fila: 2,
          nro_documento: '09900001',
          fecha: '2026-09-01',
          hora: '09:00',
          tipo_marcacion: 'ENTRADA',
        },
      ],
      empleados: [{ id: 'e' }],
      porDocumento: new Map([['09900001', { id: 'e' }]]),
      vista: { periodo: '2026-09', archivo_hash: 'hash', errores: [] },
    };
    // Act: ejecutar una única operación del componente.
    const r = await caso.guardar(preparada as never, actor);
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(r.insertadas).toBe(0);
    expect(r.duplicadas_omitidas).toBe(1);
    expect(prisma.asistencia_marcacion.createMany).not.toHaveBeenCalled();
  });
});
