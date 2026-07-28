import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { RRHHModule } from './modules/RRHH/RRHH.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/config/redis/redis.module';
import { AuditModule } from './modules/audit/audit.module';
import { TareasModule } from './modules/tareas/tareas.module';
import { ContratoModule } from './modules/contrato/contrato.module';

@Module({
  imports: [AuthModule, RRHHModule, PrismaModule, RedisModule, AuditModule, TareasModule, ContratoModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
