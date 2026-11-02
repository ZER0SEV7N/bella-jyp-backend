import { DespachoN8nService } from '@/modules/integraciones/services/despacho-n8n.service';
import axios from 'axios';
jest.mock('axios');
/** Prueba aislada: Arrange prepara mocks; Act ejecuta; Assert verifica el comportamiento. */
describe('DespachoN8nService', () => {
  const actor = {
    id: '019a0000-0002-7000-8000-000000000003',
    ip: '127.0.0.1',
  };
  const prisma = {
    integracionTrabajo: { findMany: jest.fn(), updateMany: jest.fn() },
  };
  const caso = new DespachoN8nService(prisma as never);
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.N8N_WEBHOOK_URL_TRABAJOS = 'http://n8n.example.test/webhook';
    process.env.N8N_WEBHOOK_SECRET =
      'clave-hmac-ficticia-de-unitarias-32-caracteres';
  });
  it('otra réplica no despacha el mismo registro', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.integracionTrabajo.findMany.mockResolvedValue([
      { id: 'job', intentos: 0 },
    ]);
    prisma.integracionTrabajo.updateMany.mockResolvedValue({ count: 0 });
    // Act: ejecutar una única operación del componente.
    await caso.pendientes();
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(axios.post).not.toHaveBeenCalled();
  });
  it('firma únicamente el identificador y conserva pendiente si n8n falla', async () => {
    // Arrange: preparar el escenario y los datos ficticios.
    prisma.integracionTrabajo.findMany.mockResolvedValue([
      { id: 'job', intentos: 0 },
    ]);
    prisma.integracionTrabajo.updateMany.mockResolvedValue({ count: 1 });
    jest.mocked(axios.post).mockRejectedValue(new Error('n8n detenido'));
    // Act: ejecutar una única operación del componente.
    await caso.pendientes();
    // Assert: comprobar resultado, efectos y reglas de negocio.
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      { trabajo_id: 'job' },
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Jyp-Signature': expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      })
    );
    expect(prisma.integracionTrabajo.updateMany).toHaveBeenCalledTimes(1);
  });
});
