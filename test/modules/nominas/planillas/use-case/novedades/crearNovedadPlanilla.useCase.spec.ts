import { CrearNovedadPlanillaUseCase } from '@/modules/nomina/planillas/use-case/novedades/crearNovedadPlanilla.useCase';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
    transaccionAuditada: jest.fn((p, _a, fn) => fn(p)),
    bloquearEmpleado: jest.fn(),
}));
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('CrearNovedadPlanillaUseCase', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };
    const prisma = {
        empleados: { findUnique: jest.fn() },
        novedad_planilla: { count: jest.fn(), create: jest.fn() },
    };
    const caso = new CrearNovedadPlanillaUseCase(prisma as never);
    const dto = {
        empleado_id: 'e',
        periodo: '2026-09',
        tipo: 'DESCUENTO_AUTORIZADO',
        monto: '10',
        motivo: 'Prueba documentada',
        referencia_evidencia: 'DEMO',
    };
    beforeEach(() => jest.clearAllMocks());
    it('impide exceder cien novedades por colaborador', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        prisma.empleados.findUnique.mockResolvedValue({ id: 'e' });
        prisma.novedad_planilla.count.mockResolvedValue(100);
        // Act: ejecutar una única operación del componente.
        const r = caso.execute(dto as never, actor);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        await expect(r).rejects.toThrow('cien');
        expect(prisma.novedad_planilla.create).not.toHaveBeenCalled();
    });
    it('conserva el autor de una novedad pendiente', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        prisma.empleados.findUnique.mockResolvedValue({ id: 'e' });
        prisma.novedad_planilla.count.mockResolvedValue(0);
        prisma.novedad_planilla.create.mockResolvedValue({ id: 'n' });
        // Act: ejecutar una única operación del componente.
        await caso.execute(dto as never, actor);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        expect(prisma.novedad_planilla.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ ...dto, registrado_por: actor.id }),
        });
    });
});
