import { Controller, Post, UploadedFile, UseInterceptors, Req, BadRequestException, HttpCode, HttpStatus, UsePipes, Body } from '@nestjs/common';
import { FileInterceptor } from '@nest-lab/fastify-multer';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { marcarAsistenciaSchema } from '@jyp/shared-contracts';
import type { MarcarAsistenciaDto } from '@jyp/shared-contracts';
import { CrearMarcacionManualUseCase } from '../use-cases/marcacion/crearMarcacionManual.useCase';
@Controller('api/asistencia/marcacion')
export class AsistenciaController{
    constructor(
        private readonly crearMarcacionManualUseCase: CrearMarcacionManualUseCase
    ) {}
    @Post('generar-manual')
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ZodValidationPipe( marcarAsistenciaSchema))
    async generarCierre(@Body() dto: MarcarAsistenciaDto) {
        return await this.crearMarcacionManualUseCase.execute(dto);
    }

}