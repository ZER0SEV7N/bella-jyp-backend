//src/modules/contrato/cron/contratos.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VerificarExpiracionContratosUseCase } from '../use-cases/verificarExpiracion.useCase';

/**
 * Cron job para verificar contratos próximos a expirar.
 * Este cron job se ejecuta cada 30 días y verifica cuántos contratos están próximos a vencer.
 * Si se encuentran contratos próximos a expirar, se emite un evento 'contratos.expirar.check' con la cantidad de contratos.
 *
 */
@Injectable()
export class ContratosCron {
  private readonly logger = new Logger(ContratosCron.name);

  constructor(
    private readonly verificarExpiracion: VerificarExpiracionContratosUseCase,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async revisarContratosPorVencer() {
    const cantidad = await this.verificarExpiracion.execute();

    if (cantidad > 0) 
      //Disparar el evento para notificaciones y alertas
      this.eventEmitter.emit('alerta.global', {
        titulo: 'Contratos por Vencer',
        mensaje: `Existen ${cantidad} contratos que vencerán en los próximos 30 días. Por favor, revise el panel.`,
        tipo: 'WARNING',
        modulo_origen: 'CONTRATOS',
        roles_destino: ['ADMIN', 'RRHH']
      });
  }
}