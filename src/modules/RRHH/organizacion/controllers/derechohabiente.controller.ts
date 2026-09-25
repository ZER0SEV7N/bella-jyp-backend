//src/modules/RRHH/organizacion/controllers/derechohabiente.controller.ts
import { Controller, Post, Body, Get, Param, Patch, Delete, UseGuards, UsePipes, ParseUUIDPipe, HttpCode, HttpStatus, Req, BadRequestException } from '@nestjs/common';
//Importaciones de Fastify
import type { FastifyRequest } from 'fastify';
//Importaciones de validaciones 
import { JwtAccessGuard } from '@/common/guards/jwt-access.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
//Importaciones de casos de uso
import { RegistrarDerechohabienteUseCase } from '../use-cases/derechohabiente/registrarDerechohabiente.useCase';
import { SubirSustentoDerechohabienteUseCase } from '../use-cases/derechohabiente/subirSustento.useCase';
import { ListarDerechohabientesUseCase } from '../use-cases/derechohabiente/listarDerechohabientes.useCase';
import { EstadoDerechohabienteUseCase } from '../use-cases/derechohabiente/estadoDerechohabiente.useCase';
//Dto y schemas
import { RegistrarDerechohabienteSchema, SubirSustentoDerechohabienteSchema } from '@jyp/shared-contracts';
import type { RegistrarDerechohabienteDto, SubirSustentoDerechohabienteDto } from '@jyp/shared-contracts';
//Importaciones de Swagger
import { ApiSwaggerDerechohabienteController, ApiSwaggerRegistrarDerechohabiente, ApiSwaggerSubirSustentoDerechohabiente, ApiSwaggerListarPorEmpleado, ApiSwaggerDesactivarDerechohabiente, ApiSwaggerReactivarDerechohabiente } from '../decorators/derechohabiente-swagger.decorator';

/**
 * Controlador para la gestión de derechohabientes en el módulo de RRHH.
 * Este controlador expone endpoints para registrar, listar, subir sustentos y cambiar el estado de los derechohabientes asociados a empleados titulares.
 * Se aplican guardias de autenticación y autorización para proteger los endpoints según los roles definidos.
 * Endpoints disponibles:
 * - POST /api/rrhh/derechohabientes: Registrar un nuevo derechohabiente.
 * - GET /api/rrhh/derechohabientes/empleado/:empleadoId: Listar derechohabientes de un empleado titular.
 * - DELETE /api/rrhh/derechohabientes/:id/desactivar: Desactivar un derechohabiente.
 * - PATCH /api/rrhh/derechohabientes/:id/reactivar: Reactivar un derechohabiente previamente desactivado.
 * - POST /api/rrhh/derechohabientes/sustento/abrir: Subir un sustento documental para un derechohabiente.
 */
@Controller('api/rrhh/derechohabientes')
@UseGuards(JwtAccessGuard, RolesGuard)
@ApiSwaggerDerechohabienteController()
export class DerechohabienteController {
    constructor(
        private readonly registrarUseCase: RegistrarDerechohabienteUseCase,
        private readonly subirSustentoUseCase: SubirSustentoDerechohabienteUseCase,
        private readonly listarUseCase: ListarDerechohabientesUseCase,
        private readonly estadoUseCase: EstadoDerechohabienteUseCase
    ) {}

    /**
     * Endpoint para registrar un nuevo derechohabiente asociado a un empleado titular.
     * @Post /api/rrhh/derechohabientes
     * @Roles ('ADMIN', 'RRHH') - Solo usuarios con roles ADMIN o RRHH pueden acceder a este endpoint.
     * @param dto : {
     *   - empleado_id: string - ID del empleado titular al que se asociará el derechohabiente.
     *   - documento_id: string - ID del tipo de documento del derechohabiente.
     *   - nro_documento: string - Número de documento del derechohabiente.
     *   - nombres: string - Nombres del derechohabiente.
     *   - apellidos: string - Apellidos del derechohabiente.
     *   - vinculo: string - Vínculo del derechohabiente con el empleado titular (e.g., HIJO_MENOR, CONYUGE).
     *   - estado_civil: string - Estado civil del derechohabiente.
     *   - sexo: string - Sexo del derechohabiente (M/F).
     *   - fecha_nacimiento: string - Fecha de nacimiento del derechohabiente en formato ISO (YYYY-MM-DD).     *   
     * }
     * @returns - El derechohabiente registrado con su información completa.
     * @throws BadRequestException si los datos proporcionados no cumplen con las validaciones.
     * @throws NotFoundException si el empleado titular no existe o está inactivo.
     */
    @ApiSwaggerRegistrarDerechohabiente()
    @Post('registrar')
    @Roles('ADMIN', 'RRHH')
    @UsePipes(new ZodValidationPipe(RegistrarDerechohabienteSchema))
    async registrarDerechohabiente(@Body() dto: RegistrarDerechohabienteDto) {
        return await this.registrarUseCase.execute(dto);
    }

    /**
     * Endpoint para subir un sustento documental asociado a un derechohabiente.
     * @Post /api/rrhh/derechohabientes/sustento/abrir
     * @Roles ('ADMIN', 'RRHH') - Solo usuarios con roles ADMIN o RRHH pueden acceder a este endpoint.
     * @param req - FastifyRequest que contiene el archivo multipart y los campos del formulario.
     * @returns - La referencia al sustento documental registrado en la base de datos.
     * @throws BadRequestException si no se adjunta un archivo válido o si los campos del formulario no cumplen con las validaciones.
     * @throws NotFoundException si el derechohabiente especificado no existe o ha sido dado de baja.
     */
    @Post('sustento/abrir')
    @ApiSwaggerSubirSustentoDerechohabiente()
    @Roles('ADMIN', 'RRHH')
    async subirSustento(@Req() req: FastifyRequest) {
        //Extraccion de archivo multipart y campos con fastify
        const data = await req.file();
        if(!data) throw new BadRequestException({
            title: 'Archivo Requerido',
            detail: 'Debe adjuntar un archivo válido (PDF o Word).'
        });

        //Extracción de campos del formulario multipart y validación con Zod
        const rawFields: Record<string, any> = {};
        for(const [key, value] of Object.entries(data.fields)) 
            rawFields[key] = (value as any).value;

        const parsedDto: SubirSustentoDerechohabienteDto = SubirSustentoDerechohabienteSchema.parse(rawFields);

        return await this.subirSustentoUseCase.execute(parsedDto, data);   
    }

    /**
     * Endpoint para listar los derechohabientes asociados a un empleado titular específico.
     * @Get /api/rrhh/derechohabientes/empleado/:empleadoId
     * @Roles ('ADMIN', 'RRHH') - Solo usuarios con roles ADMIN o RRHH pueden acceder a este endpoint.
     * @param empleadoId - ID del empleado titular cuyos derechohabientes se desean listar.
     * @returns - Una lista de derechohabientes asociados al empleado titular especificado.
     * @throws NotFoundException si el empleado titular no existe o no tiene derechohabientes asociados.
     */
    @Get('empleado/:empleadoId')
    @ApiSwaggerListarPorEmpleado()
    @Roles('ADMIN', 'RRHH')
    async listarPorEmpleado(@Param('empleadoId', ParseUUIDPipe) empleadoId: string) {
        return await this.listarUseCase.listarPorEmpleado(empleadoId);
    }

    /**
     * Endpoint para desactivar un derechohabiente específico.
     * @Delete /api/rrhh/derechohabientes/:id/desactivar
     * @Roles ('ADMIN', 'RRHH') - Solo usuarios con roles ADMIN o RRHH pueden acceder a este endpoint.
     * @param id - ID del derechohabiente que se desea desactivar.
     * @returns - Un mensaje de confirmación indicando que el derechohabiente ha sido desactivado.
     * @throws NotFoundException si el derechohabiente especificado no existe o ya está desactivado.
     */
    @Delete(':id/desactivar')
    @HttpCode(HttpStatus.OK)
    @ApiSwaggerDesactivarDerechohabiente()
    @Roles('ADMIN', 'RRHH')
    async desactivar(@Param('id', ParseUUIDPipe) id: string) {
        return await this.estadoUseCase.desactivar(id);
    }

    /**
     * Endpoint para reactivar un derechohabiente previamente desactivado.
     * @Patch /api/rrhh/derechohabientes/:id/reactivar
     * @Roles ('ADMIN', 'RRHH') - Solo usuarios con roles ADMIN o RRHH pueden acceder a este endpoint.
     * @param id - ID del derechohabiente que se desea reactivar.
     * @returns - Un mensaje de confirmación indicando que el derechohabiente ha sido reactivado.
     * @throws NotFoundException si el derechohabiente especificado no existe o ya está activo.
     */
    @Patch(':id/reactivar')
    @HttpCode(HttpStatus.OK)
    @ApiSwaggerReactivarDerechohabiente()
    @Roles('ADMIN', 'RRHH')
    async reactivar(@Param('id', ParseUUIDPipe) id: string) {
        return await this.estadoUseCase.reactivar(id);
    }

}
