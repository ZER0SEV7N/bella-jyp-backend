import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EmpleadoModule } from './empleado/empleado.module';
import { DatabaseModule } from './database/database.module';
import { CargoModule } from './cargo/cargo.module';

@Module({
  imports: [AuthModule, EmpleadoModule, DatabaseModule, CargoModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
