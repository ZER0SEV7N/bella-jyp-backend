import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Delete,
  UseGuards,
  Get,
  UsePipes,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
//casos de uso
import { CrearContratoUseCase } from '../use-cases/crearContrato.useCase';
//validaciones
import { FileInterceptor } from '@nestjs/platform-express';
import { configracionMulter } from '@/common/config/multer/multer';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
//shcmeas y type de zod
import type { datosContratoDto } from '@jyp/shared-contracts';
import { datosContratoSchema } from '@jyp/shared-contracts';
@Controller('api/contrato')
export class ContratoController {
  constructor(private readonly crearContratoUseCase: CrearContratoUseCase) {}
  @Post('crear')
  @UsePipes(new ZodValidationPipe(datosContratoSchema))
  @UseInterceptors(FileInterceptor('file', configracionMulter))
  async crear(
    @UploadedFile() file: Express.Multer.File,
    @Body() payload: datosContratoDto,
  ) {
    return await this.crearContratoUseCase.execute(payload);
  }
}
