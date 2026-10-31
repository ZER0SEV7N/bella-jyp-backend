import { BoletasPropiasUseCase } from '@/modules/payroll/planillas/use-case/';
describe('BoletasPropiasUseCase', () => {
    const prisma = {
            historial_planillas: { findFirst: jest.fn(), findMany: jest.fn() },
        },
        descargar = { execute: jest.fn() };
    const caso = new BoletasPropiasUseCase(prisma as never, descargar as never);
    beforeEach(() => jest.clearAllMocks());
    it('no permite descargar una planilla ajena', async () => {
        // Arrange: el filtro por usuario no encuentra la planilla ajena.
        prisma.historial_planillas.findFirst.mockResolvedValue(null);
        // Act: intentar acceder a un identificador de otro empleado.
        const r = caso.archivo('planilla-ajena', 'usuario');
        // Assert: no se abre el archivo ni se revela su existencia.
        await expect(r).rejects.toThrow('no está disponible');
        expect(descargar.execute).not.toHaveBeenCalled();
        expect(prisma.historial_planillas.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    empleados: { usuarios: { id: 'usuario' } },
                }),
            })
        );
    });
    it('entrega el archivo cuando coincide el propietario', async () => {
        // Arrange: el vínculo del usuario coincide con la planilla.
        prisma.historial_planillas.findFirst.mockResolvedValue({
            id: 'planilla',
        });
        descargar.execute.mockResolvedValue({ nombre: 'boleta.pdf' });
        // Act: descargar su propia boleta.
        const r = await caso.archivo('planilla', 'usuario');
        // Assert: se utiliza el archivo definitivo del historial.
        expect(r.nombre).toBe('boleta.pdf');
        expect(descargar.execute).toHaveBeenCalledWith('planilla');
    });
});
