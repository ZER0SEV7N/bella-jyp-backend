//src/modules/RRHH/controller/Area.controller.ts
//Controlador para manejar las operaciones relacionadas con las areas en el módulo de RRHH
import { Controller, Post, Body, HttpCode, HttpStatus, Put, Param, Patch, Delete, UseGuards, UsePipes, ParseUUIDPipe } from '@nestjs/common';
//casos de uso
import { CrearAreaUseCase } from '../use-cases/area/crearArea.useCase';
import { ActualizarAreaUseCase } from '../use-cases/area/actualizarArea.useCase';
import { EliminarAreaUseCase } from '../use-cases/area/eliminarArea.useCase';
import { ActiveAreaUseCase } from '../use-cases/area/activeArea.useCase';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { CrearAreaSchema, ActualizarAreaSchema } from '@jyp/shared-contracts';
import type { CrearAreaDto, ActualizarAreaDto } from '@jyp/shared-contracts';

@Controller('api/rrhh/area')
@UseGuards(JwtAccessGuard)
export class AreaController {
  //Inyectar los casos de uso necesarios para manejar las operaciones relacionadas con las areas
  constructor(
    private readonly crearAreaUseCase: CrearAreaUseCase,
    private readonly actualizarAreaUseCase: ActualizarAreaUseCase,
    private readonly eliminarAreaUseCase: EliminarAreaUseCase,
    private readonly activeAreaUseCase: ActiveAreaUseCase,
  ) {}

  /**
   * Crear un nuevo area
   * POST - /api/rrhh/area/crear 
   * @param payload : dtoCrearAreaInput{
   *    "nombre" : "Area-prueba-Nro1",
   *    "descripcion" : "Descripcion-Nro1"
   * }
   * @Returns
   */
  @Post('crear')
  @UsePipes(new ZodValidationPipe(CrearAreaSchema))
  async crear(@Body() payload: CrearAreaDto) {
    return await this.crearAreaUseCase.execute(payload);
  }

  /**
   * Actualizar un area existente
   * PATCH - /api/rrhh/area/:id/actualizar
   * @param id string - UUID
   * @param payload : dtoActualizarAreaInput{
   *    "nombre" : "Area-Nro1",
   *    "descripcion" : "Descripcion-Nro1"
   * }
   * @returns
   */
  @Patch(':id/actualizar')
  @UsePipes(new ZodValidationPipe(ActualizarAreaSchema))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: ActualizarAreaDto
  ) {
    return await this.actualizarAreaUseCase.execute(id, payload);
  }

  /**
   * Reactivar un area que se encuentra desactivada
   * PATCH - /api/rrhh/area/:id/reactive
   * @param id - string - uuid
   * @returns: Promise<any>
   */
  @Patch(':id/reactive')
  @HttpCode(HttpStatus.OK)
  async reactive(@Param('id') id: string) {
    return await this.activeAreaUseCase.execute(id);
  }

  /**
   * Eliminar un area (SOFT DELETE)
   * DELETE - /api/rrhh/area/:id/desactive
   * @param id string - UUID
   * @returns
   */
  @Delete(':id/desactive')
  @HttpCode(HttpStatus.OK)
  async eliminar(@Param('id') id: string) {
    return await this.eliminarAreaUseCase.execute(id);
  }
  
}
