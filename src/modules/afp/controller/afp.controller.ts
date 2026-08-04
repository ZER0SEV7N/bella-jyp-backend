import { Controller } from '@nestjs/common';
import { agregarAportacionUseCase } from '../use-cases/aportaciones/agregarAportacion.useCse';
import { agregarComisionUseCase } from '../use-cases/comisiones/agregarComision.useCase';
import { agregarTipoAfpUseCase } from '../use-cases/tipoAfp/agregarAfp.useCase';

@Controller('api/afp')
export class afpController {
  constructor(
    //aportaciones
    private readonly agregarAportaciones: agregarAportacionUseCase,
    //comisiones
    private readonly agregarComisiones: agregarComisionUseCase,
    //tipoAfp
    private readonly agregarTipoAfp: agregarTipoAfpUseCase,
  ) {}
}
