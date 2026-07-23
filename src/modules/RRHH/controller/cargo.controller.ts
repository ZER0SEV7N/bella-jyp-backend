//src/modules/RRHH/controller/cargo.controller.ts
//Controlador para manejar las operaciones relacionadas con los cargos en el módulo de RRHH
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Put,
  Param,
  Patch,
  Delete,
  UseGuards,
  UsePipes,
  ParseUUIDPipe,
} from '@nestjs/common';
//casos de uso
import { CrearCargoUseCase } from '../use-cases/cargos/crearCargo.useCase';
import { ActualizarCargoUseCase } from '../use-cases/cargos/actualizarCargo.useCase';
import { EliminarCargoUseCase } from '../use-cases/cargos/eliminarCargo.useCase';
import { ActiveCargoUseCase } from '../use-cases/cargos/activeCargo.useCase';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { CrearCargoSchema, ActualizarCargoSchema } from '@jyp/shared-contracts';
import type { CrearCargoDto, ActualizarCargoDto } from '@jyp/shared-contracts';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

//Controller para manejar las operaciones relacionadas con los cargos en el módulo de RRHH
@Controller('api/rrhh/cargo')
@UseGuards(JwtAccessGuard)
export class CargoController {
  constructor(
    private readonly crearCargoUseCase: CrearCargoUseCase,
    private readonly actualizarCargoUseCase: ActualizarCargoUseCase,
    private readonly eliminarCargoUseCase: EliminarCargoUseCase,
    private readonly activeCargoUseCase: ActiveCargoUseCase,
  ) {}

  /**
   * Crear un nuevo cargo
   * @url http://localhost:3000/api/rrhh/cargo/crear
   * @param payload {
   *  "id_area" : id string - uuid
   *  "nombre" : "nombre de area"
   *  "descripcion" : "decripcionm"
   * }
   */
  @Post('crear')
  @UsePipes(new ZodValidationPipe(CrearCargoSchema))
  async crear(@Body() payload: CrearCargoDto) {
    return await this.crearCargoUseCase.execute(payload);
  }

  /**
   *editar cargo
   * @url http://localhost:3000/api/rrhh/cargo/@param /actualizar
   * @param id string - uuid
   * @param payload {
   *  "id_area" : id string - uuid
   *  "nombre" : "nombre de area"
   *  "descripcion" : "decripcionm"
   * }
   */
  @Put(':id/actualizar')
  @UsePipes(new ZodValidationPipe(ActualizarCargoSchema))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: ActualizarCargoDto,
  ) {
    return await this.actualizarCargoUseCase.execute(id, payload);
  }

  /**
   * Eliminar un cargo (SOFT DELETE)
   * @url http://localhost:3000/api/rrhh/cargo/@param /desactive
   * @param id string - uuid
   */
  @Delete(':id/desactive')
  @HttpCode(HttpStatus.OK)
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return await this.eliminarCargoUseCase.execute(id);
  }

  /**
   * Reactivar un cargo que se encuentra desactivado
   * @url http://localhost:3000/api/rrhh/cargo/@param /reactive
   * @param id string - uuid
   */
  @Patch(':id/reactive')
  @HttpCode(HttpStatus.OK)
  async reactive(@Param('id', ParseUUIDPipe) id: string) {
    return await this.activeCargoUseCase.execute(id);
  }
}
