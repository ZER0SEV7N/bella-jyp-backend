import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UsePipes,
} from '@nestjs/common';
import { agregarDatosFinancieroUseCase } from '../use-case/agregarDatoFinanciero.useCase';
import { editarDatoFinancieroUseCase } from '../use-case/editarDatoFinanciero.useCase';
import { obtenerDatoFinancieroUseCase } from '../use-case/obtenerDatoFinanciero.useCase';

@Controller()
export class datoFinancieroController {
  constructor(
    private readonly agregarDatoFinanciero: agregarDatosFinancieroUseCase,
    private readonly editarDatoFinanciero: editarDatoFinancieroUseCase,
    private readonly obtenerDatoFinanciero: obtenerDatoFinancieroUseCase,
  ) {}
  @Get('id:/obtener')
  @HttpCode(HttpStatus.OK)
  async obtenerDatos(@Param('id', ParseUUIDPipe) id: string) {
    return await this.obtenerDatoFinanciero.execute(id);
  }
}
