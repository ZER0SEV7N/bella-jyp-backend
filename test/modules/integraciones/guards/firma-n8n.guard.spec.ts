import { FirmaN8NGuard } from '@/common/guards/firma-n8n.guard';
import { firmarM2M } from '@/common/utils/firma-m2m.util';
describe('FirmaN8NGuard', () => {
  const redis = { set: jest.fn() };
  const guard = new FirmaN8NGuard(redis as never);
  const secret = 'secreto-ficticio-de-pruebas-de-32-caracteres';
  function peticion() {
    const instante = String(Math.floor(Date.now() / 1000)),
      nonce = '019a0000-0000-7000-8000-000000000001',
      body = { trabajo_id: 'trabajo' };
    const req = {
      method: 'POST',
      url: '/api/v1/integraciones/n8n/validar',
      body,
      headers: {
        'x-jyp-timestamp': instante,
        'x-jyp-nonce': nonce,
        'x-jyp-signature': firmarM2M(
          secret,
          'POST',
          '/api/v1/integraciones/n8n/validar',
          instante,
          nonce,
          body
        ),
      },
    };
    return {
      req,
      context: { switchToHttp: () => ({ getRequest: () => req }) },
    };
  }
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.N8N_WEBHOOK_SECRET = secret;
  });
  it('acepta una firma válida y reserva su nonce', async () => {
    // Arrange: JSON firmado por la llave compartida y nonce sin uso.
    const { context } = peticion();
    redis.set.mockResolvedValue('OK');
    // Act: evaluar la guardia sin red ni Redis real.
    const r = await guard.canActivate(context as never);
    // Assert: la reserva es atómica y temporal.
    expect(r).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('n8n:nonce:'),
      '1',
      'EX',
      600,
      'NX'
    );
  });
  it('rechaza la repetición aunque la firma sea correcta', async () => {
    // Arrange: Redis informa que el nonce ya existe.
    const { context } = peticion();
    redis.set.mockResolvedValue(null);
    // Act: volver a presentar el mensaje.
    const r = guard.canActivate(context as never);
    // Assert: no se ejecuta una segunda operación con el mismo sobre.
    await expect(r).rejects.toThrow('utilizado');
  });
  it('no reserva el nonce de un cuerpo alterado', async () => {
    // Arrange: cambiar el identificador después de firmar.
    const { context, req } = peticion();
    req.body.trabajo_id = 'alterado';
    // Act: verificar la integridad.
    const r = guard.canActivate(context as never);
    // Assert: rechazo previo a cualquier escritura en Redis.
    await expect(r).rejects.toThrow('firma');
    expect(redis.set).not.toHaveBeenCalled();
  });
});
