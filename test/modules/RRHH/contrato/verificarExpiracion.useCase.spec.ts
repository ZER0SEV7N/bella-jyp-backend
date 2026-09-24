//test/modules/RRHH/contrato/verificarExpiracion.useCase.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/common/prisma/prisma.service';
import { VerificarExpiracionContratosUseCase } from '@/modules/RRHH/contrato/use-cases/verificarExpiracion.useCase';

/**
 * Pruebas unitarias exhaustivas para el caso de uso VerificarExpiracionContratosUseCase.
 * Se verifica el comportamiento esperado en diferentes escenarios, incluyendo:
 * - Retorno correcto de la cantidad de contratos próximos a vencer dentro del rango de 30 días.
 * - Manejo de casos donde no hay contratos próximos a vencer.
 * - Validación de la correcta interacción con el servicio Prisma para contar los contratos.
 */
describe('VerificarExpiracionContratosUseCase - Pruebas Unitarias Exhaustivas', () => {
    let useCase: VerificarExpiracionContratosUseCase;
    let prismaService: PrismaService;

    //Mock del servicio Prisma para simular la interacción con la base de datos
    const mockPrismaService = {
        contratos: {count: jest.fn()}
    };

    //Configuración del módulo de pruebas antes de cada test
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VerificarExpiracionContratosUseCase,
                { provide: PrismaService, useValue: mockPrismaService }
            ]
        }).compile();

        useCase = module.get<VerificarExpiracionContratosUseCase>(VerificarExpiracionContratosUseCase);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => jest.clearAllMocks());

    describe('execute()', () => {
        it('Debe retornar la cantidad exacta de contratos próximos a vencer dentro del rango de 30 días', async () => {
            //Arrange: Simulación de que hay 7 contratos próximos a vencer en la base de datos
            mockPrismaService.contratos.count.mockResolvedValue(7);

            //Act: Ejecución del caso de uso para verificar la expiración de contratos
            const cantidad = await useCase.execute();

            //Assert: Verificación de que la cantidad retornada es la esperada y que el método count del servicio Prisma fue llamado con los parámetros correctos
            expect(prismaService.contratos.count).toHaveBeenCalledWith({
                where: {
                    renovado: false,
                    fecha_fin: {
                        gte: expect.any(Date),
                        lte: expect.any(Date)
                    },
                    deleted_at: null
                }
            });
            expect(cantidad).toBe(7);
        });

        it('Debe retornar 0 cuando no hay contratos en la ventana de expiración', async () => {
            //Arrange: Simulación de que no hay contratos próximos a vencer en la base de datos
            mockPrismaService.contratos.count.mockResolvedValue(0);

            //Act & Assert: Ejecución del caso de uso y verificación de que la cantidad retornada es 0
            const cantidad = await useCase.execute();
            expect(cantidad).toBe(0);
        });
    });
});