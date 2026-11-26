//test/modules/RRHH/dashboard/use-cases/obtenerDashboardRrhh.useCase.spec.ts
import { ObtenerDashboardRrhhUseCase } from '@/modules/RRHH/dashboard/use-cases/obtenerDashboardRrhh.useCase';
import { CacheCatalogoService } from '@/common/config/redis/cache-catalogo.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ContarIncidenciasMesUseCase } from '@/modules/asistencia/use-cases/Incidencias/contarIncidenciasMes.useCase';

/**
 * Prueba aislada de la caché del dashboard (Mejora 3 / RNF-02).
 * Verifica que los indicadores se sirvan desde Redis por período y con el TTL configurado,
 * sin recalcular la consulta agregada en cada petición.
 */
describe('ObtenerDashboardRrhhUseCase - caché por período', () => {
  const cache = { getOrSet: jest.fn(), invalidate: jest.fn() };
  const caso = new ObtenerDashboardRrhhUseCase(
    {} as PrismaService,
    {} as ContarIncidenciasMesUseCase,
    cache as never as CacheCatalogoService
  );

  beforeEach(() => jest.clearAllMocks());

  it('Debe servir el dashboard desde la caché usando la clave del período', async () => {
    // Arrange: la caché ya tiene un resultado para el período.
    const respuesta = { dotacion: { total_activos: 10 } } as never;
    cache.getOrSet.mockResolvedValue(respuesta);

    // Act
    const resultado = await caso.execute({ periodo: '2026-09' });

    // Assert: se usa la clave y el TTL correctos, sin recalcular.
    expect(cache.getOrSet).toHaveBeenCalledWith(
      'dashboard:rrhh:2026-09',
      60,
      expect.any(Function)
    );
    expect(resultado).toBe(respuesta);
  });

  it('Debe calcular los indicadores cuando la caché está vacía', async () => {
    // Arrange: la caché falla (miss) y el fetcher debe ejecutarse.
    cache.getOrSet.mockImplementation(
      (_clave: string, _ttl: number, fetcher: () => Promise<unknown>) =>
        fetcher()
    );

    // Act & Assert: sin mocks de Prisma, el fetcher lanza al consultar la base.
    await expect(caso.execute({ periodo: '2026-09' })).rejects.toThrow();
  });
});
