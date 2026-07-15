//src/modules/auth/use-cases/crearUsuarioInterno.useCase.ts
//Caso de uso para provisionar un usuario interno
//Se encarga de crear un usuario interno en la base de datos, asociado a un empleado existente
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ProvisionarUsuarioDTO } from '@jyp/shared-contracts';

@Injectable()
export class ProvisionarUsuarioUseCase {
  constructor(private readonly prisma: PrismaService) {}

  //Metodo principal para ejecutar el caso de uso
  async execute(dto: ProvisionarUsuarioDTO) {
    if (!dto.email)
      throw new BadRequestException(
        'El correo corporativo es estrictamente obligatorio para crear credenciales.',
      );

    //Buscar el empleado por nro_documento
    const empleado = await this.prisma.empleados.findUnique({
      where: { nro_documento: dto.nro_documento },
    });

    //Validación: Si el empleado no existe, lanzar una excepción NotFoundException
    if (!empleado)
      throw new NotFoundException({
        type: 'https://api.jyp.com/errors/not-found',
        title: 'Empleado Inexistente',
        detail: `El empleado con documento ${dto.nro_documento} no existe. RRHH debe registrarlo primero.`,
      });

    //Ubicar el usuario existente por empleado_id para evitar duplicados
    const existeUsuario = await this.prisma.usuarios.findUnique({
      where: { empleado_id: empleado.id },
    });

    //Validación: Si el usuario ya existe, lanzar una excepción ConflictException
    if (existeUsuario)
      throw new ConflictException({
        type: 'https://api.jyp.com/errors/conflict',
        title: 'Usuario Existente',
        detail: 'Este empleado ya posee credenciales de acceso activas.',
      });

    //Hash de la contraseña usando Argon2id
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    //Crear el nuevo usuario en la base de datos
    const nuevoUsuario = await this.prisma.usuarios.create({
      data: {
        id: crypto.randomUUID(), //Usando UUIDv7 si lo tienes, o randomUUID nativo
        empleado_id: empleado.id,
        email: dto.email,
        password_hash: passwordHash,
        rol: dto.rol as any, //Cast de seguridad para empatar con Enum de Prisma
        activo: true,
      },
      include: {
        empleados: {
          select: { nro_documento: true },
        },
      },
    });
    return {
      id: nuevoUsuario.id,
      rol: nuevoUsuario.rol,
      nro_documento: nuevoUsuario.empleados?.nro_documento,
    };
  }
}
