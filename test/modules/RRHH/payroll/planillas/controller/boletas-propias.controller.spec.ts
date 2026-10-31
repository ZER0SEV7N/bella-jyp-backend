import { BoletasPropiasController } from '@/modules/payroll/planillas/controller/boletas-propias.controller';
describe('BoletasPropiasController', () => {
    const caso = { listar: jest.fn(), archivo: jest.fn() };
    const controller = new BoletasPropiasController(caso as never);
    beforeEach(() => jest.clearAllMocks());
    it('Consulta usando exclusivamente el usuario de la sesión', async () => {
        // Arrange: el ID proviene de la autenticación, sin empleado_id suministrado por el cliente.
        const req = { user: { id: 'usuario' } };
        caso.listar.mockResolvedValue([{ id: 'planilla' }]);
        // Act: consultar las boletas personales.
        const r = await controller.listar(req as never);
        // Assert: conserva el filtro por propietario.
        expect(caso.listar).toHaveBeenCalledWith('usuario');
        expect(r).toEqual([{ id: 'planilla' }]);
    });
    it('Entrega el PDF archivado después de comprobar pertenencia', async () => {
        // Arrange: un archivo ya autorizado por el caso de uso.
        const req = { user: { id: 'usuario' } };
        const reply = {
            type: jest.fn().mockReturnThis(),
            header: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };
        caso.archivo.mockResolvedValue({
            tipo: 'application/pdf',
            nombre: 'boleta.pdf',
            stream: 'stream ficticio',
        });
        // Act: descargar por el endpoint propio.
        await controller.archivo('planilla', req as never, reply as never);
        // Assert: no cambia el propietario ni reconstruye el documento.
        expect(caso.archivo).toHaveBeenCalledWith('planilla', 'usuario');
        expect(reply.send).toHaveBeenCalledWith('stream ficticio');
    });
});
