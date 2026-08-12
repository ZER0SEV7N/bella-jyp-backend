import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  Patch,
  UsePipes,
  Param,
  ParseUUIDPipe,
  Delete,
  Put,
} from '@nestjs/common';
//casos de uso
import { CrearContratoUseCase } from '../use-cases/crearContrato.useCase';
import { EliminarContratoUseCase } from '../use-cases/eliminarContrato.useCase';
import { RenovarContratoUseCase } from '../use-cases/renovarContrato.useCase';
//comon y  librerias
import { FileInterceptor } from '@nest-lab/fastify-multer';
import { configracionMulter } from '@/common/config/multer/multer';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import type { datosContratoDto, editarContratDto } from '@jyp/shared-contracts';
import {
  datosContratoSchema,
  editarContratoSchema,
} from '@jyp/shared-contracts';
import { EditarContratoUseCase } from '../use-cases/editarContrato.useCase';

@Controller('api/contrato')
export class ContratoController {
  constructor(
    private readonly crearContratoUseCase: CrearContratoUseCase,
    private readonly eliminarContratoUseCase: EliminarContratoUseCase,
    private readonly renovaContratoUseCase: RenovarContratoUseCase,
    private readonly editarContratoUseCase: EditarContratoUseCase,
  ) {}
  /**
   * @Url :POST -  http://localhost:3000/api/contrato/crear
   * @param file : pdf
   * @param payload {
   *
   * }
   */
  @Post('crear')
  @UseInterceptors(FileInterceptor('file', configracionMulter))
  async crear(
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(datosContratoSchema)) payload: datosContratoDto,
  ) {
    return await this.crearContratoUseCase.execute(payload, file.filename);
  }
  /**
   * @Url :PUT -  http://localhost:3000/api/contrato/:id/editar
   * @param file : pdf
   * @param payload {
   * }
   */
  //actualziar
  @Put(':id/editar')
  @UsePipes(new ZodValidationPipe(editarContratoSchema))
  async editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() payload: editarContratDto,
  ) {
    return await this.editarContratoUseCase.execute(payload, id);
  }
  //eliminar contrato
  @Delete(':id/eliminar')
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return await this.eliminarContratoUseCase.execute(id);
  }
  //actualizar contrato
  @Patch(':id/renovar')
  async renovar(@Param('id', ParseUUIDPipe) id: string) {
    return await this.renovaContratoUseCase.execute(id);
  }
}
