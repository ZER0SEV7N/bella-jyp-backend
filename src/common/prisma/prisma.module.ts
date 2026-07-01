import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // ⬅️ IMPORTANTE: Esto lo hace disponible en toda la app sin re-importarlo
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}