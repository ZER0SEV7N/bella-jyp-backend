//test/modules/RRHH/contrato/contratos.cron.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContratosCron } from '@/modules/RRHH/contrato/cron/contratos.cron';
import { VerificarExpiracionContratosUseCase } from '@/modules/RRHH/contrato/use-cases/verificarExpiracion.useCase';

/**
 * Pruebas unitarias exhaustivas para el cron de contratos.
 * Se verifica el comportamiento esperado en diferentes escenarios, incluyendo:
 * - Emisión de eventos de alerta cuando hay contratos próximos a vencer.
 * - No emisión de eventos cuando no hay contratos próximos a vencer.
 * - Validación de la correcta interacción con el caso de uso VerificarExpiracionContratosUseCase y el EventEmitter2.
 */
describe('ContratosCron - Pruebas Unitarias Exhaustivas', () => {
    let cron: ContratosCron;
    let verificarExpiracionUseCase: VerificarExpiracionContratosUseCase;
    let eventEmitter: EventEmitter2;

    const mockVerificarExpiracionUseCase = {execute: jest.fn()};

    const mockEventEmitter = {emit: jest.fn()};

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ContratosCron,
                { provide: VerificarExpiracionContratosUseCase, useValue: mockVerificarExpiracionUseCase },
                { provide: EventEmitter2, useValue: mockEventEmitter }
            ]
        }).compile();

        cron = module.get<ContratosCron>(ContratosCron);
        verificarExpiracionUseCase = module.get<VerificarExpiracionContratosUseCase>(VerificarExpiracionContratosUseCase);
        eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    });

    afterEach(() => jest.clearAllMocks());

    describe('revisarContratosPorVencer()', () => {
        it('Debe emitir un evento alerta.global si la cantidad de contratos por vencer es mayor a 0', async () => {
            mockVerificarExpiracionUseCase.execute.mockResolvedValue(4);

            await cron.revisarContratosPorVencer();

            expect(verificarExpiracionUseCase.execute).toHaveBeenCalled();
            expect(eventEmitter.emit).toHaveBeenCalledWith('alerta.global',
                expect.objectContaining({
                    titulo: 'Contratos por Vencer',
                    mensaje: expect.stringContaining('Existen 4 contratos que vencerán'),
                    tipo: 'WARNING',
                    modulo_origen: 'CONTRATOS',
                    roles_destino: expect.arrayContaining(['ADMIN', 'RRHH'])
                })
            );
        });

        it('No debe emitir ninguna alerta si la cantidad de contratos por vencer es igual a 0', async () => {
            mockVerificarExpiracionUseCase.execute.mockResolvedValue(0);

            await cron.revisarContratosPorVencer();

            expect(verificarExpiracionUseCase.execute).toHaveBeenCalled();
            expect(eventEmitter.emit).not.toHaveBeenCalled();
        });
    });
});