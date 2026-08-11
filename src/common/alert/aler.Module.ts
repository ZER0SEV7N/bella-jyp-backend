import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { ExpirationCheckCron } from './corn/expiracion_contrato.cron';
import { Contratos_Expirar } from './use-case/contratos-expirar.useCase';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [ExpirationCheckCron, Contratos_Expirar],
})
export class AlertModule {}
