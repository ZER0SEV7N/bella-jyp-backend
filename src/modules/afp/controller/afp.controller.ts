import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { AgregarAportacionUseCase } from '../use-cases/aportaciones/agregarAportacion.useCse';
import { AgregarComisionUseCase } from '../use-cases/comisiones/agregarComision.useCase';
import { AgregarTipoAfpUseCase } from '../use-cases/tipoAfp/agregarAfp.useCase';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import type {
  AportacionesDto,
  CrearComisionDto,
  crearTipoAfpDto,
} from '@jyp/shared-contracts';
import {
  aportacionesSchema,
  crearComisionSchema,
  crearTipo_AfpSchema,
} from '@jyp/shared-contracts';

@Controller('api/afp')
export class afpController {
  constructor(
    //aportaciones
    private readonly agregarAportaciones: AgregarAportacionUseCase,
    //comisiones
    private readonly agregarComisiones: AgregarComisionUseCase,
    //tipoAfp
    private readonly agregarTipoAfp: AgregarTipoAfpUseCase,
  ) {}

  @Post('agregar/comicion')
  @UsePipes(new ZodValidationPipe(crearComisionSchema))
  async crearComision(@Body() dto: CrearComisionDto) {
    return await this.agregarComisiones.execute(dto);
  }
  @Post('agregar/tipo_afp')
  @UsePipes(new ZodValidationPipe(crearTipo_AfpSchema))
  async agregarAfp(@Body() dto: crearTipoAfpDto) {
    return await this.agregarTipoAfp.execute(dto);
  }
  @Post('agregar/aportacion')
  @UsePipes(new ZodValidationPipe(aportacionesSchema))
  async agregarAportacion(@Body() dto: AportacionesDto) {
    return await this.agregarAportaciones.execute(dto);
  }
}
