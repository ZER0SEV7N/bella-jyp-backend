import { CrearTrabajoIntegracionUseCase } from '@/modules/integraciones/use-cases/crearTrabajoIntegracion.useCase';
import { CryptoUtil } from '@/common/utils/crypto.util';
describe('CrearTrabajoIntegracionUseCase', () => {
  const tx = {
    historial_planillas: { findMany: jest.fn() },
    integracionTrabajo: { findUnique: jest.fn(), create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
  const caso = new CrearTrabajoIntegracionUseCase(prisma as never);
  const dto = {
    tipo: 'COSTOS' as const,
    periodo: '2026-09',
    idempotencia: '019a0000-0000-7000-8000-000000000001',
    configuracion: {},
  };
  const actor = { id: 'contador', ip: '127.0.0.1' };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY = 'clave-ficticia-solo-unitarias';
    tx.historial_planillas.findMany.mockResolvedValue([
      { id: 'planilla', estado: 'CONGELADO' },
    ]);
    tx.integracionTrabajo.findUnique.mockResolvedValue(null);
    tx.integracionTrabajo.create.mockImplementation(({ data }) => ({
      ...data,
      estado: 'PENDIENTE',
    }));
  });
  it('cifra la intención y no realiza trabajo de archivos en HTTP', async () => {
    // Arrange: todas las planillas del filtro ya están cerradas.
    const entrada = { ...dto };
    // Act: solicitar la exportación de costos.
    const r = await caso.execute(entrada, actor);
    // Assert: estado pendiente, sin exponer cuentas o solicitud cifrada en la respuesta.
    expect(r.estado).toBe('PENDIENTE');
    const guardada = tx.integracionTrabajo.create.mock.calls[0][0].data;
    expect(guardada.solicitud_cifrada).toMatch(/^enc:v1:/);
    expect(JSON.parse(CryptoUtil.decrypt(guardada.solicitud_cifrada)!)).toEqual(
      dto
    );
    expect(r).not.toHaveProperty('solicitud_cifrada');
  });
  it('reutiliza una clave idéntica sin duplicar el trabajo', async () => {
    // Arrange: existe la misma solicitud cifrada con JSON canónico.
    const texto = JSON.stringify({
      configuracion: {},
      idempotencia: dto.idempotencia,
      periodo: dto.periodo,
      tipo: dto.tipo,
    });
    tx.integracionTrabajo.findUnique.mockResolvedValue({
      id: 'anterior',
      tipo: 'COSTOS',
      solicitud_cifrada: CryptoUtil.encrypt(texto),
    });
    // Act: reenviar la misma clave.
    const r = await caso.execute(dto, actor);
    // Assert: devuelve el registro anterior y no escribe otro.
    expect(r.id).toBe('anterior');
    expect(tx.integracionTrabajo.create).not.toHaveBeenCalled();
  });
  it('rechaza una selección con planillas abiertas', async () => {
    // Arrange: todavía hay una planilla sin aprobación final.
    tx.historial_planillas.findMany.mockResolvedValue([
      { id: 'p', estado: 'ABIERTO' },
    ]);
    // Act: solicitar el archivo del período.
    const r = caso.execute(dto, actor);
    // Assert: no se registra un trabajo que parezca definitivo.
    await expect(r).rejects.toThrow('cerrar');
    expect(tx.integracionTrabajo.create).not.toHaveBeenCalled();
  });
  it.each(['BBVA_HABERES', 'INTERBANK_HABERES'])(
    'no inventa el diseño propio de %s',
    async (tipo) => {
      // Arrange: formato cuyo diseño del canal aún no se ha homologado.
      const entrada = { ...dto, tipo } as never;
      // Act: solicitar ese formato bancario.
      const r = caso.execute(entrada, actor);
      // Assert: error 422 antes de consultar la nómina.
      await expect(r).rejects.toMatchObject({ status: 422 });
      expect(tx.historial_planillas.findMany).not.toHaveBeenCalled();
    }
  );
});

describe('CrearTrabajoIntegracionUseCase: límites y datos de cada canal', () => {
  const tx = {
    historial_planillas: { findMany: jest.fn() },
    integracionTrabajo: { findUnique: jest.fn(), create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
  const caso = new CrearTrabajoIntegracionUseCase(prisma as never);
  const dto = {
    tipo: 'COSTOS',
    periodo: '2026-09',
    idempotencia: '019a0000-0000-7000-8000-000000000001',
    configuracion: {},
  };
  const actor = { id: 'contador', ip: '127.0.0.1' };
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-30T17:00:00Z'));
    process.env.FINANCIAL_DATA_ENCRYPTION_KEY = 'clave-ficticia-solo-unitarias';
    tx.historial_planillas.findMany.mockResolvedValue([
      { id: 'p', estado: 'DECLARADO' },
    ]);
    tx.integracionTrabajo.findUnique.mockResolvedValue(null);
    tx.integracionTrabajo.create.mockImplementation(({ data }) => ({
      ...data,
      estado: 'PENDIENTE',
    }));
  });
  afterEach(() => jest.useRealTimers());
  it.each([
    ['sin planillas', []],
    [
      'más de mil',
      Array.from({ length: 1001 }, (_, i) => ({
        id: String(i),
        estado: 'CONGELADO',
      })),
    ],
  ])('rechaza selección %s', async (_nombre, planillas) => {
    // Arrange: selección vacía o superior al límite de procesamiento.
    tx.historial_planillas.findMany.mockResolvedValue(planillas);
    // Act: solicitar una exportación sin crear archivos en HTTP.
    const resultado = caso.execute(dto as never, actor);
    // Assert: no registrar trabajos que no podrán atenderse.
    await expect(resultado).rejects.toMatchObject({ status: 400 });
    expect(tx.integracionTrabajo.create).not.toHaveBeenCalled();
  });
  it('aplica simultáneamente los filtros explícitos de empleado y área', async () => {
    // Arrange: el contador limita la selección por ambos campos.
    const datos = { ...dto, empleado_id: 'empleado', area_id: 'area' };
    // Act: solicitar el resumen de costos de esa selección.
    await caso.execute(datos as never, actor);
    // Assert: no exportar planillas fuera del ámbito indicado.
    expect(tx.historial_planillas.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          periodo: '2026-09',
          empleado_id: 'empleado',
          empleados: { area_id: 'area' },
        },
        take: 1001,
      })
    );
  });
  it.each([
    {},
    {
      cuenta_cargo: '1910000000001',
      tipo_cuenta_cargo: 'C',
      fecha_pago: '2026-02-30',
      referencia: 'PRUEBA',
    },
    {
      cuenta_cargo: '1910000000001',
      tipo_cuenta_cargo: 'C',
      fecha_pago: '2026-10-29',
      referencia: 'PRUEBA',
    },
  ])(
    'rechaza datos BCP incompletos o fecha inválida/pasada',
    async (configuracion) => {
      // Arrange: datos del banco con una causa de rechazo previa a consultar planillas.
      const datos = { ...dto, tipo: 'BCP_HABERES', configuracion };
      // Act: solicitar el archivo bancario.
      const resultado = caso.execute(datos as never, actor);
      // Assert: ninguna intención se persiste si el encabezado no puede ser válido.
      await expect(resultado).rejects.toMatchObject({ status: 400 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  );
  it('admite la fecha de pago BCP de hoy', async () => {
    // Arrange: la fecha está justo en el límite permitido, calculado en Lima.
    const datos = {
      ...dto,
      tipo: 'BCP_HABERES',
      configuracion: {
        cuenta_cargo: '1910000000001',
        tipo_cuenta_cargo: 'C',
        fecha_pago: '2026-10-30',
        referencia: 'PRUEBA',
      },
    };
    // Act: solicitar la exportación.
    const resultado = await caso.execute(datos as never, actor);
    // Assert: la tarea queda pendiente; no se ejecuta un pago desde el endpoint.
    expect(resultado.estado).toBe('PENDIENTE');
  });
  it.each([undefined, false])(
    'PLAME exige confirmación expresa del pago (%s)',
    async (confirmar) => {
      // Arrange: cerrar una planilla no constituye confirmación de pago efectivo.
      const datos = {
        ...dto,
        tipo: 'PLAME',
        configuracion: { confirmar_montos_pagados: confirmar },
      };
      // Act: intentar exportar remuneraciones sin la decisión contable requerida.
      const resultado = caso.execute(datos as never, actor);
      // Assert: no crear un archivo que declare pagos supuestos.
      await expect(resultado).rejects.toThrow('confirmar');
      expect(tx.integracionTrabajo.create).not.toHaveBeenCalled();
    }
  );
  it('rechaza reutilizar la clave con otro contenido', async () => {
    // Arrange: existe un trabajo con diferente solicitud cifrada.
    tx.integracionTrabajo.findUnique.mockResolvedValue({
      tipo: 'COSTOS',
      solicitud_cifrada: CryptoUtil.encrypt('{"periodo":"2026-08"}'),
    });
    // Act: repetir la clave para otra petición.
    const resultado = caso.execute(dto as never, actor);
    // Assert: la idempotencia no debe sobrescribir intenciones anteriores.
    await expect(resultado).rejects.toMatchObject({ status: 409 });
    expect(tx.integracionTrabajo.create).not.toHaveBeenCalled();
  });
});
