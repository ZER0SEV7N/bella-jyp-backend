import { Module } from '@nestjs/common';
import { AlertsGateway } from './contrato/contratos.websocket';

@Module({
  providers: [AlertsGateway],
  exports: [AlertsGateway],
})
export class WebSocketsModule {}
