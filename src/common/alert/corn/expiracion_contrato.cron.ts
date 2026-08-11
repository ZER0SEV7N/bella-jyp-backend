// workers/expiration-check.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Contratos_Expirar } from '../use-case/contratos-expirar.useCase';

@Injectable()
export class ExpirationCheckCron {
  private readonly logger = new Logger(ExpirationCheckCron.name);

  constructor(
    private readonly contratosExpirar: Contratos_Expirar,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('0 0 0 */30 * *')
  async handleCron() {
    const cantidad = await this.contratosExpirar.execute();
    this.logger.log(`Contratos próximos a vencer: ${cantidad}`);

    if (cantidad > 0) {
      this.eventEmitter.emit('contratos.expirar.check', { cantidad });
    }
  }
}
