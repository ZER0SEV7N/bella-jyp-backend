import { Controller, Post, HttpCode, HttpStatus, UsePipes, Body, Res } from '@nestjs/common';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { marcarAsistenciaSchema } from '@jyp/shared-contracts';
import type { MarcarAsistenciaDto } from '@jyp/shared-contracts';
import { CrearMarcacionManualUseCase } from '../use-cases/asistencias/crearMarcacionManual.useCase';
@Controller('api/asistencia/marcacion')
export class AsistenciaController{
    constructor(
        private readonly crearMarcacionManualUseCase: CrearMarcacionManualUseCase,
    ) {}
    @Post('web')
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ZodValidationPipe( marcarAsistenciaSchema))
    async generarCierre(@Body() dto: MarcarAsistenciaDto) {
        return await this.crearMarcacionManualUseCase.execute(dto);
    }
    
}