import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { RRHHModule } from './modules/RRHH/RRHH.module';

@Module({
  imports: [AuthModule, RRHHModule, ],
  controllers: [AppController, ],
  providers: [AppService],
})
export class AppModule {}
