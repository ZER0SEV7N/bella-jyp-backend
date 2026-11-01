import { RegistrarDesembolsoUseCase } from '@/modules/payroll/planillas/use-case/desembolso/registrarDesembolso.useCase';
jest.mock('@/common/utils/transaccion-auditada.util', () => ({
    transaccionAuditada: jest.fn((p, _a, fn) => fn(p)),
    bloquearEmpleado: jest.fn(),
}));
import { Prisma } from '@prisma/client';
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('RegistrarDesembolsoUseCase', () => {
    const actor = {
        id: '019a0000-0002-7000-8000-000000000003',
        ip: '127.0.0.1',
    };
    const prisma = {
        solicitud: { findUnique: jest.fn() },
        adelanto_desembolso: { findUnique: jest.fn(), create: jest.fn() },
    };
    const caso = new RegistrarDesembolsoUseCase(prisma as never);
    const dto = {
        solicitud_id: 's',
        fecha: '2026-09-01',
        periodo_descuento: '2026-09',
        referencia: 'Constancia ficticia',
    };
    beforeEach(() => jest.clearAllMocks());
    it('no permite desembolsar una solicitud pendiente', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        prisma.solicitud.findUnique.mockResolvedValue({
            estado: 'PENDIENTE',
            tipo: 'ADELANTO_SUELDO',
        });
        // Act: ejecutar una única operación del componente.
        const r = caso.execute(dto, actor);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        await expect(r).rejects.toThrow('aprobada');
        expect(prisma.adelanto_desembolso.create).not.toHaveBeenCalled();
    });
    it('impide una segunda entrega de dinero para la misma solicitud', async () => {
        // Arrange: preparar el escenario y los datos ficticios.
        prisma.solicitud.findUnique.mockResolvedValue({
            id: 's',
            empleado_id: 'e',
            estado: 'APROBADA',
            tipo: 'ADELANTO_SUELDO',
            monto: new Prisma.Decimal(100),
        });
        prisma.adelanto_desembolso.findUnique.mockResolvedValue({
            id: 'previo',
        });
        // Act: ejecutar una única operación del componente.
        const r = caso.execute(dto, actor);
        // Assert: comprobar resultado, efectos y reglas de negocio.
        await expect(r).rejects.toThrow('ya tiene');
        expect(prisma.adelanto_desembolso.create).not.toHaveBeenCalled();
    });
});
