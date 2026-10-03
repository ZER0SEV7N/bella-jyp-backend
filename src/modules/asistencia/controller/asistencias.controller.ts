import { Controller, Post, HttpCode, HttpStatus, UsePipes, Body, Res, UseGuards, Query, Get } from '@nestjs/common';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { ListarMarcacionesQuerySchema, marcarAsistenciaSchema } from '@jyp/shared-contracts';
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import type { ListarMarcacionesQueryDto, MarcarAsistenciaDto } from '@jyp/shared-contracts';
import { CrearMarcacionManualUseCase } from '../use-cases/asistencias/crearMarcacionManual.useCase';
import { ListarMarcacionesUseCase } from '../use-cases/asistencias/listarMarcaciones.useCase';

@Controller('api/asistencia/marcacion')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN', 'RRHH', 'CONTADOR', 'ASISTENTE')
export class AsistenciaController{
    constructor(private readonly crearMarcacionManualUseCase: CrearMarcacionManualUseCase,
                private readonly listarMarcacionesUseCase: ListarMarcacionesUseCase
    ) {}

    @Post('web')
    @HttpCode(HttpStatus.OK)
    @UsePipes(new ZodValidationPipe( marcarAsistenciaSchema))
    async generarCierre(@Body() dto: MarcarAsistenciaDto) {
        return await this.crearMarcacionManualUseCase.execute(dto);
    }

    @Get()
    @UsePipes(new ZodValidationPipe(ListarMarcacionesQuerySchema))
    async listarMarcaciones(@Query() query: ListarMarcacionesQueryDto) {
        return await this.listarMarcacionesUseCase.execute(query);
    }
    
}