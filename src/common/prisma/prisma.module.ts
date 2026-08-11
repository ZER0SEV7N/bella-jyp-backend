import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ClsModule } from 'nestjs-cls';

@Global()
@Module({
  imports: [ClsModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
