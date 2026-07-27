import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CrearContratoUseCase } from '../use-cases/crearContrato.useCase';
import { FileInterceptor } from '@nest-lab/fastify-multer';
import { configracionMulter } from '@/common/config/multer/multer';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import type { datosContratoDto } from '@jyp/shared-contracts';
import { datosContratoSchema } from '@jyp/shared-contracts';

@Controller('api/contrato')
export class ContratoController {
  constructor(private readonly crearContratoUseCase: CrearContratoUseCase) {}

  @Post('crear')
  @UseInterceptors(FileInterceptor('file', configracionMulter))
  async crear(
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(datosContratoSchema)) payload: datosContratoDto,
  ) {
    return await this.crearContratoUseCase.execute(payload);
  }
}